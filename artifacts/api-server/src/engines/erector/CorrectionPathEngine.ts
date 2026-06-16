import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  blueprints,
  db,
  erectorCapabilityGaps,
  erectorCapabilityProfiles,
  erectorCapabilityGraph,
  erectorCorrectionPaths,
  erectorSimulationRuns,
  erectorValidationRuns,
  erectorEvidenceLedger,
  falseProgressFlags,
} from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { EVENT_TYPES, writeEvent } from "../../services/EventService.js";
import { generateEconomicCorrection } from "./EconomicCorrectionGenerator.js";
import type {
  CorrectionPathCustomerView,
  CorrectionPathInput,
  CorrectionPathRecord,
  CorrectionType,
} from "./correction/types.js";

const OPEN_STATUSES = ["open", "in_progress"] as const;

const STRENGTH_RANK: Record<string, number> = {
  NONE: 0,
  LOW: 1,
  "LOW-MEDIUM": 2,
  MEDIUM: 3,
  "MEDIUM-HIGH": 4,
  HIGH: 5,
};

function mapRow(row: typeof erectorCorrectionPaths.$inferSelect): CorrectionPathRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    blueprint_id: row.blueprint_id,
    validation_run_id: row.validation_run_id,
    source_engine: row.source_engine,
    source_id: row.source_id,
    correction_type: row.correction_type as CorrectionType,
    blocked_action: row.blocked_action,
    reason: row.reason,
    user_visible_reason: row.user_visible_reason,
    required_actions: row.required_actions,
    required_evidence: row.required_evidence,
    revalidation_required: row.revalidation_required,
    unblock_condition: row.unblock_condition,
    status: row.status,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    created_at: row.created_at,
  };
}

export function toCustomerView(path: CorrectionPathRecord): CorrectionPathCustomerView {
  return {
    id: path.id,
    what_is_blocked: customerBlockedLabel(path.blocked_action),
    why_blocked: path.user_visible_reason,
    what_to_do: path.required_actions,
    proof_needed: path.required_evidence,
    progress_hint: path.unblock_condition,
    status: path.status,
  };
}

function customerBlockedLabel(blockedAction: string): string {
  switch (blockedAction) {
    case "blueprint_launch":
      return "Launch is paused until this correction is complete";
    case "phase_advancement":
      return "Phase advancement is paused until readiness requirements are met";
    case "outcome_reward":
      return "Outcome rewards are paused until evidence is consistent";
    case "identity_advancement":
      return "Identity advancement is paused until progress is verified";
    case "task_generation":
      return "New execution tasks are paused until capability proof is submitted";
    default:
      return "This part of your plan is paused until the correction is complete";
  }
}

export async function openCorrectionPath(input: CorrectionPathInput): Promise<string> {
  const [existing] = await db
    .select({ id: erectorCorrectionPaths.id })
    .from(erectorCorrectionPaths)
    .where(
      and(
        eq(erectorCorrectionPaths.user_id, input.userId),
        input.blueprintId
          ? eq(erectorCorrectionPaths.blueprint_id, input.blueprintId)
          : sql`${erectorCorrectionPaths.blueprint_id} IS NULL`,
        eq(erectorCorrectionPaths.correction_type, input.correctionType),
        eq(erectorCorrectionPaths.source_id, input.sourceId),
        inArray(erectorCorrectionPaths.status, [...OPEN_STATUSES]),
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  const [row] = await db
    .insert(erectorCorrectionPaths)
    .values({
      user_id: input.userId,
      blueprint_id: input.blueprintId ?? null,
      validation_run_id: input.validationRunId ?? null,
      source_engine: input.sourceEngine,
      source_id: input.sourceId,
      correction_type: input.correctionType,
      blocked_action: input.blockedAction,
      reason: input.reason,
      user_visible_reason: input.userVisibleReason,
      required_actions: input.requiredActions,
      required_evidence: input.requiredEvidence ?? [],
      revalidation_required: input.revalidationRequired ?? false,
      unblock_condition: input.unblockCondition,
      status: "open",
      audit_id: input.auditId ?? null,
    })
    .returning({ id: erectorCorrectionPaths.id });

  if (!row) throw new Error("Failed to open correction path");

  logger.info(
    {
      correctionPathId: row.id,
      correctionType: input.correctionType,
      blueprintId: input.blueprintId,
    },
    "[CorrectionPathEngine] Correction path opened",
  );

  return row.id;
}

export async function openEconomicModelCorrection(input: {
  userId: string;
  blueprintId: string;
  validationRunId: string;
  simulationRunId: string;
  archetype: string;
  failureType: string;
  reason: string;
  probabilityProceed?: number | null;
  auditId?: string | null;
}): Promise<string> {
  const spec = generateEconomicCorrection({
    archetype: input.archetype,
    failureType: input.failureType,
    probabilityProceed: input.probabilityProceed,
  });

  return openCorrectionPath({
    userId: input.userId,
    blueprintId: input.blueprintId,
    validationRunId: input.validationRunId,
    sourceEngine: "EconomicCorrectionGenerator",
    sourceId: input.simulationRunId,
    correctionType: "ECONOMIC_MODEL_FAILURE",
    blockedAction: "blueprint_launch",
    reason: input.reason,
    userVisibleReason: spec.user_visible_reason,
    requiredActions: [spec.core_correction, ...spec.required_actions],
    requiredEvidence: spec.required_evidence,
    revalidationRequired: spec.revalidation_required,
    unblockCondition: spec.unblock_condition,
    auditId: input.auditId,
  });
}

export async function getActiveCorrectionPaths(
  userId: string,
  blueprintId: string,
): Promise<CorrectionPathRecord[]> {
  const rows = await db
    .select()
    .from(erectorCorrectionPaths)
    .where(
      and(
        eq(erectorCorrectionPaths.user_id, userId),
        eq(erectorCorrectionPaths.blueprint_id, blueprintId),
        inArray(erectorCorrectionPaths.status, [...OPEN_STATUSES]),
      ),
    )
    .orderBy(desc(erectorCorrectionPaths.created_at));

  return rows.map(mapRow);
}

export async function getCorrectionPathById(
  correctionPathId: string,
  userId: string,
): Promise<CorrectionPathRecord | null> {
  const [row] = await db
    .select()
    .from(erectorCorrectionPaths)
    .where(
      and(
        eq(erectorCorrectionPaths.id, correctionPathId),
        eq(erectorCorrectionPaths.user_id, userId),
      ),
    )
    .limit(1);

  return row ? mapRow(row) : null;
}

async function loadCorrectionPath(correctionPathId: string) {
  const [row] = await db
    .select()
    .from(erectorCorrectionPaths)
    .where(eq(erectorCorrectionPaths.id, correctionPathId))
    .limit(1);
  return row ?? null;
}

async function checkValidationAdjustUnblocked(path: typeof erectorCorrectionPaths.$inferSelect) {
  if (!path.validation_run_id) return false;
  const [run] = await db
    .select({ verdict: erectorValidationRuns.verdict })
    .from(erectorValidationRuns)
    .where(eq(erectorValidationRuns.id, path.validation_run_id))
    .limit(1);
  return run?.verdict === "PROCEED";
}

async function checkPivotRequiredUnblocked(path: typeof erectorCorrectionPaths.$inferSelect) {
  if (!path.validation_run_id) return false;
  const [run] = await db
    .select({
      verdict: erectorValidationRuns.verdict,
      selected_path: erectorValidationRuns.selected_path,
    })
    .from(erectorValidationRuns)
    .where(eq(erectorValidationRuns.id, path.validation_run_id))
    .limit(1);
  if (!run) return false;
  if (run.verdict === "PROCEED") return true;
  return Boolean(run.selected_path && run.selected_path !== "current");
}

async function checkFalseProgressUnblocked(path: typeof erectorCorrectionPaths.$inferSelect) {
  if (!path.blueprint_id) return false;
  const flags = await db
    .select({ false_progress_score: falseProgressFlags.false_progress_score })
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, path.blueprint_id),
        eq(falseProgressFlags.resolved, false),
      ),
    );
  if (flags.length === 0) return true;
  const maxScore = Math.max(...flags.map((f) => f.false_progress_score ?? 0));
  return maxScore < 30;
}

async function checkContradictionUnblocked(path: typeof erectorCorrectionPaths.$inferSelect) {
  if (!path.blueprint_id) return false;
  const evidence = await db
    .select({
      evidence_strength: erectorEvidenceLedger.evidence_strength,
      contradiction_status: erectorEvidenceLedger.contradiction_status,
    })
    .from(erectorEvidenceLedger)
    .where(eq(erectorEvidenceLedger.blueprint_id, path.blueprint_id))
    .orderBy(desc(erectorEvidenceLedger.created_at))
    .limit(5);

  return evidence.some(
    (row) =>
      (STRENGTH_RANK[row.evidence_strength?.toUpperCase() ?? "NONE"] ?? 0) >= STRENGTH_RANK.HIGH &&
      !row.contradiction_status,
  );
}

async function checkAcademyProofUnblocked(path: typeof erectorCorrectionPaths.$inferSelect) {
  if (!path.user_id || !path.blueprint_id) return false;

  const gaps = await db
    .select({
      capability_id: erectorCapabilityGaps.capability_id,
      status: erectorCapabilityGaps.status,
    })
    .from(erectorCapabilityGaps)
    .where(
      and(
        eq(erectorCapabilityGaps.user_id, path.user_id),
        eq(erectorCapabilityGaps.blueprint_id, path.blueprint_id),
        eq(erectorCapabilityGaps.blocks_execution, true),
        inArray(erectorCapabilityGaps.status, ["open", "in_academy"]),
      ),
    );

  if (gaps.length === 0) return true;

  for (const gap of gaps) {
    const [profile] = await db
      .select({ capability_signal: erectorCapabilityProfiles.capability_signal })
      .from(erectorCapabilityProfiles)
      .where(
        and(
          eq(erectorCapabilityProfiles.user_id, path.user_id),
          eq(erectorCapabilityProfiles.capability_id, gap.capability_id),
        ),
      )
      .limit(1);

    const [node] = await db
      .select({ minimum_signal_threshold: erectorCapabilityGraph.minimum_signal_threshold })
      .from(erectorCapabilityGraph)
      .where(eq(erectorCapabilityGraph.capability_id, gap.capability_id))
      .limit(1);

    const signal = profile?.capability_signal ?? 0;
    const threshold = node?.minimum_signal_threshold ?? 60;
    if (signal < threshold) return false;
  }

  return true;
}

async function checkPhaseGateUnblocked(path: typeof erectorCorrectionPaths.$inferSelect) {
  if (!path.blueprint_id) return false;
  const { evaluatePhaseGate } = await import("./PhaseGateEngine.js");
  const [blueprint] = await db
    .select({ current_phase_id: blueprints.current_phase_id })
    .from(blueprints)
    .where(eq(blueprints.id, path.blueprint_id))
    .limit(1);
  if (!blueprint?.current_phase_id) return false;

  const result = await evaluatePhaseGate({
    userId: path.user_id,
    blueprintId: path.blueprint_id,
    phaseId: blueprint.current_phase_id,
    skipCorrectionOpen: true,
  });
  return result.gate_result === "PASSED";
}

async function checkEconomicModelUnblocked(path: typeof erectorCorrectionPaths.$inferSelect) {
  if (!path.validation_run_id) return false;
  const [sim] = await db
    .select({
      hard_vetoes: erectorSimulationRuns.hard_vetoes,
      probability_proceed: erectorSimulationRuns.probability_proceed,
    })
    .from(erectorSimulationRuns)
    .where(eq(erectorSimulationRuns.validation_run_id, path.validation_run_id))
    .orderBy(desc(erectorSimulationRuns.created_at))
    .limit(1);

  if (!sim) return false;
  if ((sim.hard_vetoes?.length ?? 0) > 0) return false;
  if (sim.probability_proceed != null && sim.probability_proceed < 25) return false;
  return true;
}

export async function checkUnblockCondition(correctionPathId: string): Promise<{
  met: boolean;
  still_needed: string[];
}> {
  const path = await loadCorrectionPath(correctionPathId);
  if (!path || path.status === "resolved") {
    return { met: path?.status === "resolved", still_needed: [] };
  }

  let met = false;
  switch (path.correction_type as CorrectionType) {
    case "VALIDATION_ADJUST":
      met = await checkValidationAdjustUnblocked(path);
      break;
    case "PIVOT_REQUIRED":
      met = await checkPivotRequiredUnblocked(path);
      break;
    case "FALSE_PROGRESS":
      met = await checkFalseProgressUnblocked(path);
      break;
    case "CONTRADICTION":
      met = await checkContradictionUnblocked(path);
      break;
    case "ACADEMY_PROOF_FAILURE":
      met = await checkAcademyProofUnblocked(path);
      break;
    case "PHASE_GATE_BLOCK":
      met = await checkPhaseGateUnblocked(path);
      break;
    case "ECONOMIC_MODEL_FAILURE":
      met = await checkEconomicModelUnblocked(path);
      break;
    default:
      met = false;
  }

  return {
    met,
    still_needed: met ? [] : [...path.required_actions, ...path.required_evidence],
  };
}

export async function resolveCorrectionPath(
  correctionPathId: string,
  resolvedBy: string,
): Promise<void> {
  const path = await loadCorrectionPath(correctionPathId);
  if (!path || path.status === "resolved") return;

  await db
    .update(erectorCorrectionPaths)
    .set({
      status: "resolved",
      resolved_at: new Date(),
      resolved_by: resolvedBy,
    })
    .where(eq(erectorCorrectionPaths.id, correctionPathId));

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_CORRECTION_RESOLVED,
    entityType: "erector_correction_path",
    entityId: correctionPathId,
    userId: path.user_id,
    blueprintId: path.blueprint_id ?? undefined,
    payload: {
      correction_type: path.correction_type,
      resolved_by: resolvedBy,
    },
    idempotencyKey: `erector_correction_resolved:${correctionPathId}`,
  }).catch(() => null);
}

export async function checkAndResolveCorrectionPath(
  correctionPathId: string,
  resolvedBy = "system_check",
): Promise<{ resolved: boolean; still_needed: string[]; next_step?: string }> {
  const check = await checkUnblockCondition(correctionPathId);
  if (!check.met) {
    return { resolved: false, still_needed: check.still_needed };
  }

  await resolveCorrectionPath(correctionPathId, resolvedBy);
  const path = await loadCorrectionPath(correctionPathId);
  const nextStep =
    path?.correction_type === "PHASE_GATE_BLOCK"
      ? "phase_advancement"
      : path?.correction_type === "VALIDATION_ADJUST" || path?.correction_type === "PIVOT_REQUIRED"
        ? "revalidation"
        : path?.correction_type === "ECONOMIC_MODEL_FAILURE"
          ? "resimulation"
          : "continue_execution";

  return { resolved: true, still_needed: [], next_step: nextStep };
}

export async function openFalseProgressCorrection(input: {
  userId: string;
  blueprintId: string;
  flagId: string;
  reason: string;
  requiredActions: string[];
}): Promise<string> {
  return openCorrectionPath({
    userId: input.userId,
    blueprintId: input.blueprintId,
    sourceEngine: "FalseProgressEngine",
    sourceId: input.flagId,
    correctionType: "FALSE_PROGRESS",
    blockedAction: "phase_advancement",
    reason: input.reason,
    userVisibleReason:
      "Your recent progress needs stronger outcome evidence before advancing.",
    requiredActions: input.requiredActions,
    requiredEvidence: ["HIGH strength evidence showing real outcome movement"],
    revalidationRequired: false,
    unblockCondition: "False progress score drops below 30 after correction evidence",
  });
}

export async function openPhaseGateCorrection(input: {
  userId: string;
  blueprintId: string;
  phaseGateId: string;
  blockingReasons: string[];
}): Promise<string> {
  return openCorrectionPath({
    userId: input.userId,
    blueprintId: input.blueprintId,
    sourceEngine: "PhaseGateEngine",
    sourceId: input.phaseGateId,
    correctionType: "PHASE_GATE_BLOCK",
    blockedAction: "phase_advancement",
    reason: input.blockingReasons.join("; ") || "Phase readiness requirements not met",
    userVisibleReason:
      "Your phase readiness score is below the threshold required to advance.",
    requiredActions: input.blockingReasons,
    requiredEvidence: [],
    revalidationRequired: false,
    unblockCondition: "Phase gate re-evaluation returns PASSED",
  });
}
