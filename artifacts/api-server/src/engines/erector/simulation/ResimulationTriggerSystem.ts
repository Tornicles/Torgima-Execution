import { randomUUID } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  blueprints,
  db,
  erectorEvidenceLedger,
  erectorPhaseGates,
  erectorResimulationRuns,
  erectorSignals,
  erectorSimulationRuns,
  falseProgressFlags,
  users,
} from "@workspace/db";
import { EVENT_TYPES, writeEvent } from "../../../services/EventService.js";
import { updateBlueprintErectorState } from "../erectorStateMachine.js";
import { calculateSimulationScores } from "./SimulationScoringEngine.js";
import type {
  ResimulationContext,
  ResimulationTriggerType,
  SimulationScoringInput,
} from "./types.js";

export function detectResimulationTriggers(
  ctx: ResimulationContext,
): ResimulationTriggerType[] {
  const triggers: ResimulationTriggerType[] = [];

  if (ctx.outcomeMovementDelta14d <= -25 && ctx.blueprintActiveDays > 21) {
    triggers.push("signal_shift_detector");
  }

  if (ctx.demandSignalDelta <= -20 && ctx.highEvidenceSubmittedLast7d) {
    triggers.push("demand_change_detector");
  }

  if (ctx.falseProgressSignal > 70 && ctx.openHighSeverityFlags >= 2) {
    triggers.push("false_progress_trigger");
  }

  if (ctx.consecutivePhaseGateFailures >= 2) {
    triggers.push("phase_gate_failure_trigger");
  }

  if (ctx.tier === "ultimate" && ctx.marketSignalDelta7d <= -30) {
    triggers.push("market_context_change_trigger");
  }

  return triggers;
}

export interface ResimulationCheckResult {
  should_resimulate: boolean;
  triggers: ResimulationTriggerType[];
  changed_signals: string[];
}

export async function buildResimulationContextFromBlueprint(
  userId: string,
  blueprintId: string,
): Promise<ResimulationContext> {
  const [bp] = await db
    .select({
      erector_tier: users.erector_tier,
      user_tier: users.tier,
      created_at: blueprints.created_at,
    })
    .from(blueprints)
    .innerJoin(users, eq(blueprints.user_id, users.id))
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  const tier = bp?.erector_tier ?? bp?.user_tier ?? "growth";
  const blueprintActiveDays = bp?.created_at
    ? Math.floor((Date.now() - bp.created_at.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const currentSignals = await db
    .select({
      signal_type: erectorSignals.signal_type,
      value: erectorSignals.value,
    })
    .from(erectorSignals)
    .where(
      and(
        eq(erectorSignals.user_id, userId),
        eq(erectorSignals.blueprint_id, blueprintId),
        eq(erectorSignals.status, "current"),
      ),
    );

  const signalValue = (type: string) =>
    currentSignals.find((row) => row.signal_type === type)?.value ?? 0;

  async function signalDelta(type: string): Promise<number> {
    const current = signalValue(type);
    const [prev] = await db
      .select({ value: erectorSignals.value })
      .from(erectorSignals)
      .where(
        and(
          eq(erectorSignals.user_id, userId),
          eq(erectorSignals.blueprint_id, blueprintId),
          eq(erectorSignals.signal_type, type),
          eq(erectorSignals.status, "superseded"),
        ),
      )
      .orderBy(desc(erectorSignals.generated_at))
      .limit(1);

    return current - (prev?.value ?? current);
  }

  const [outcomeMovementDelta14d, demandSignalDelta, marketSignalDelta7d] = await Promise.all([
    signalDelta("OUTCOME_MOVEMENT_SIGNAL"),
    signalDelta("DEMAND_SIGNAL"),
    signalDelta("MARKET_SIGNAL"),
  ]);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const evidenceRows = await db
    .select({ evidence_strength: erectorEvidenceLedger.evidence_strength })
    .from(erectorEvidenceLedger)
    .where(
      and(
        eq(erectorEvidenceLedger.user_id, userId),
        eq(erectorEvidenceLedger.blueprint_id, blueprintId),
        gte(erectorEvidenceLedger.submitted_at, weekAgo),
      ),
    );

  const highEvidenceSubmittedLast7d = evidenceRows.some(
    (row) => row.evidence_strength === "HIGH",
  );

  const gateRows = await db
    .select({ gate_result: erectorPhaseGates.gate_result })
    .from(erectorPhaseGates)
    .where(eq(erectorPhaseGates.blueprint_id, blueprintId))
    .orderBy(desc(erectorPhaseGates.evaluated_at));

  let consecutivePhaseGateFailures = 0;
  for (const gate of gateRows) {
    if (gate.gate_result === "BLOCKED") consecutivePhaseGateFailures += 1;
    else break;
  }

  const openFlags = await db
    .select({ severity: falseProgressFlags.severity })
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.user_id, userId),
        eq(falseProgressFlags.blueprint_id, blueprintId),
        eq(falseProgressFlags.resolved, false),
      ),
    );

  const openHighSeverityFlags = openFlags.filter((row) => row.severity === "high").length;

  return {
    tier,
    blueprintActiveDays,
    outcomeMovementDelta14d,
    demandSignalDelta,
    highEvidenceSubmittedLast7d,
    falseProgressSignal: signalValue("FALSE_PROGRESS_SIGNAL"),
    openHighSeverityFlags,
    consecutivePhaseGateFailures,
    marketSignalDelta7d,
  };
}

export async function checkResimulationTriggers(
  userId: string,
  blueprintId: string,
): Promise<ResimulationCheckResult> {
  const ctx = await buildResimulationContextFromBlueprint(userId, blueprintId);
  const triggers = detectResimulationTriggers(ctx);
  const changed_signals: string[] = [];

  if (ctx.outcomeMovementDelta14d <= -25) changed_signals.push("OUTCOME_MOVEMENT_SIGNAL");
  if (ctx.demandSignalDelta <= -20) changed_signals.push("DEMAND_SIGNAL");
  if (ctx.falseProgressSignal > 70) changed_signals.push("FALSE_PROGRESS_SIGNAL");
  if (ctx.marketSignalDelta7d <= -30) changed_signals.push("MARKET_SIGNAL");

  return {
    should_resimulate: triggers.length > 0,
    triggers,
    changed_signals,
  };
}

export interface ResimulationRunInput {
  userId: string;
  blueprintId: string;
  originalSimulationId: string;
  triggerType: ResimulationTriggerType;
  triggerDescription: string;
  scoringInput: SimulationScoringInput;
  changedInputs: Record<string, unknown>;
  previousProbability: number;
  previousVerdict: string;
}

export async function createResimulationRun(
  input: ResimulationRunInput,
): Promise<{ resimulationId: string; warningEmitted: boolean; verdictChanged: boolean }> {
  const updatedScores = calculateSimulationScores(input.scoringInput);
  const probabilityDelta = updatedScores.probability_proceed - input.previousProbability;
  const newVerdict =
    updatedScores.probability_proceed < 25 ? "BLOCKED" : input.previousVerdict;
  const verdictChanged = newVerdict !== input.previousVerdict;

  const auditId = randomUUID();
  const [row] = await db
    .insert(erectorResimulationRuns)
    .values({
      user_id: input.userId,
      blueprint_id: input.blueprintId,
      original_simulation_id: input.originalSimulationId,
      trigger_type: input.triggerType,
      trigger_description: input.triggerDescription,
      changed_inputs: input.changedInputs,
      previous_probability: input.previousProbability,
      updated_probability: updatedScores.probability_proceed,
      probability_delta: probabilityDelta,
      verdict_changed: verdictChanged,
      previous_verdict: input.previousVerdict,
      new_verdict: newVerdict,
      audit_id: auditId,
    })
    .returning({ id: erectorResimulationRuns.id });

  if (!row) throw new Error("Failed to create resimulation run");

  let warningEmitted = false;
  if (probabilityDelta <= -20) {
    warningEmitted = true;
    await writeEvent({
      eventType: EVENT_TYPES.ERECTOR_RESIMULATION_WARNING,
      entityType: "erector_simulation_run",
      entityId: input.originalSimulationId,
      userId: input.userId,
      blueprintId: input.blueprintId,
      payload: {
        resimulation_id: row.id,
        probability_delta: probabilityDelta,
        previous_probability: input.previousProbability,
        updated_probability: updatedScores.probability_proceed,
      },
      idempotencyKey: `erector_resimulation_warning:${row.id}`,
    });
  }

  if (verdictChanged) {
    await updateBlueprintErectorState(input.blueprintId, "CORRECTION_REQUIRED");
  }

  return { resimulationId: row.id, warningEmitted, verdictChanged };
}

export async function checkAndRunResimulation(
  ctx: ResimulationContext,
  input: Omit<ResimulationRunInput, "triggerType" | "triggerDescription">,
): Promise<string[]> {
  const triggers = detectResimulationTriggers(ctx);
  const created: string[] = [];

  for (const triggerType of triggers) {
    const result = await createResimulationRun({
      ...input,
      triggerType,
      triggerDescription: `Resimulation triggered by ${triggerType}`,
    });
    created.push(result.resimulationId);
  }

  return created;
}

export async function loadLatestSimulationForBlueprint(blueprintId: string) {
  const [row] = await db
    .select()
    .from(erectorSimulationRuns)
    .where(eq(erectorSimulationRuns.blueprint_id, blueprintId))
    .limit(1);

  const [bp] = await db
    .select({ erector_simulation_id: blueprints.erector_simulation_id })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  return row ?? (bp?.erector_simulation_id ? { id: bp.erector_simulation_id } : null);
}
