import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  blueprints,
  db,
  erectorArchetypeRulePacks,
  erectorBlueprintLaunchContracts,
  erectorCapabilityGaps,
  erectorEvidenceLedger,
  erectorPhaseGates,
  falseProgressFlags,
  outcomeValidations,
  phases,
  targets,
} from "@workspace/db";
import { EVENT_TYPES, writeEvent } from "../../services/EventService.js";
import { openPhaseGateCorrection } from "./CorrectionPathEngine.js";
import type { PhaseGateCriterionResult, PhaseGateResult } from "./correction/types.js";

const STRENGTH_RANK: Record<string, number> = {
  NONE: 0,
  LOW: 1,
  "LOW-MEDIUM": 2,
  MEDIUM: 3,
  "MEDIUM-HIGH": 4,
  HIGH: 5,
};

function severityRank(value: string | null | undefined): number {
  const normalized = (value ?? "low").toLowerCase();
  if (normalized === "critical") return 4;
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;
  return 0;
}

function scoreFromCriteria(results: PhaseGateCriterionResult[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter((row) => row.passed).length;
  return Math.round((passed / results.length) * 100);
}

function gateResultFromScore(score: number): PhaseGateResult["gate_result"] {
  if (score >= 80) return "PASSED";
  if (score >= 50) return "PARTIAL";
  return "BLOCKED";
}

async function loadGateCriteria(input: {
  archetype: string;
  blueprintId: string;
}): Promise<Array<{ id: string; label: string }>> {
  const [rulePack] = await db
    .select({ required_phase_gates: erectorArchetypeRulePacks.required_phase_gates })
    .from(erectorArchetypeRulePacks)
    .where(eq(erectorArchetypeRulePacks.archetype_id, input.archetype))
    .limit(1);

  const [contract] = await db
    .select({ required_phase_gates: erectorBlueprintLaunchContracts.required_phase_gates })
    .from(erectorBlueprintLaunchContracts)
    .where(
      and(
        eq(erectorBlueprintLaunchContracts.blueprint_id, input.blueprintId),
        eq(erectorBlueprintLaunchContracts.consumed, false),
      ),
    )
    .limit(1);

  const packGates = Array.isArray(rulePack?.required_phase_gates)
    ? (rulePack!.required_phase_gates as Array<{ id?: string; label?: string }>)
    : [];
  const contractGates = Array.isArray(contract?.required_phase_gates)
    ? (contract!.required_phase_gates as Array<{ id?: string; label?: string }>)
    : [];

  const merged = new Map<string, { id: string; label: string }>();
  for (const gate of [...packGates, ...contractGates]) {
    const id = gate.id ?? gate.label ?? "custom_gate";
    merged.set(id, { id, label: gate.label ?? id });
  }

  if (merged.size === 0) {
    return [
      { id: "payment_proof", label: "At least one payment proof in this phase" },
      { id: "no_critical_false_progress", label: "No critical false progress flags open" },
      { id: "no_blocking_capability_gaps", label: "No blocking capability gaps open" },
      { id: "validated_outcomes", label: "Required targets have validated outcomes" },
    ];
  }

  return [...merged.values()];
}

export async function evaluatePhaseGate(input: {
  userId: string;
  blueprintId: string;
  phaseId: string;
  skipCorrectionOpen?: boolean;
}): Promise<PhaseGateResult> {
  const [phase] = await db
    .select()
    .from(phases)
    .where(and(eq(phases.id, input.phaseId), eq(phases.blueprint_id, input.blueprintId)))
    .limit(1);

  if (!phase) throw new Error("Phase not found");

  const [blueprint] = await db
    .select({
      erector_archetype: blueprints.erector_archetype,
      current_phase_id: blueprints.current_phase_id,
    })
    .from(blueprints)
    .where(eq(blueprints.id, input.blueprintId))
    .limit(1);

  const archetype = blueprint?.erector_archetype ?? "direct_service_delivery";
  const criteria = await loadGateCriteria({
    archetype,
    blueprintId: input.blueprintId,
  });

  const phaseStartedAt = phase.started_at ?? phase.created_at ?? new Date(0);
  const phaseEvidence = await db
    .select()
    .from(erectorEvidenceLedger)
    .where(
      and(
        eq(erectorEvidenceLedger.blueprint_id, input.blueprintId),
        gte(erectorEvidenceLedger.submitted_at, phaseStartedAt),
      ),
    );

  const openFlags = await db
    .select()
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, input.blueprintId),
        eq(falseProgressFlags.resolved, false),
      ),
    );

  const blockingGaps = await db
    .select({ id: erectorCapabilityGaps.id })
    .from(erectorCapabilityGaps)
    .where(
      and(
        eq(erectorCapabilityGaps.blueprint_id, input.blueprintId),
        eq(erectorCapabilityGaps.blocks_execution, true),
        inArray(erectorCapabilityGaps.status, ["open", "in_academy"]),
      ),
    );

  const phaseTargets = phase.target_id
    ? [{ id: phase.target_id }]
    : await db
        .select({ id: targets.id })
        .from(targets)
        .where(
          and(
            eq(targets.blueprint_id, input.blueprintId),
            inArray(targets.status, ["active", "pending"]),
          ),
        );

  const targetIds = phaseTargets.map((row) => row.id);
  const validations =
    targetIds.length > 0
      ? await db
          .select({ validation_result: outcomeValidations.validation_result, target_id: outcomeValidations.target_id })
          .from(outcomeValidations)
          .where(
            and(
              eq(outcomeValidations.blueprint_id, input.blueprintId),
              inArray(outcomeValidations.target_id, targetIds),
            ),
          )
      : [];

  const criteriaResults: PhaseGateCriterionResult[] = criteria.map((criterion) => {
    switch (criterion.id) {
      case "payment_proof": {
        const hasPayment = phaseEvidence.some(
          (row) =>
            row.evidence_class === "PAYMENT_PROOF" &&
            (STRENGTH_RANK[row.evidence_strength?.toUpperCase() ?? "NONE"] ?? 0) >=
              STRENGTH_RANK.MEDIUM,
        );
        return {
          criterion_id: criterion.id,
          label: criterion.label,
          passed: hasPayment,
          detail: hasPayment ? undefined : "Submit payment proof from this phase",
        };
      }
      case "no_critical_false_progress": {
        const severe = openFlags.some((flag) => severityRank(flag.severity) >= 3);
        return {
          criterion_id: criterion.id,
          label: criterion.label,
          passed: !severe,
          detail: severe ? "Resolve open false progress flags" : undefined,
        };
      }
      case "no_blocking_capability_gaps": {
        return {
          criterion_id: criterion.id,
          label: criterion.label,
          passed: blockingGaps.length === 0,
          detail:
            blockingGaps.length > 0
              ? "Complete academy proof for open capability gaps"
              : undefined,
        };
      }
      case "validated_outcomes": {
        if (targetIds.length === 0) {
          return { criterion_id: criterion.id, label: criterion.label, passed: true };
        }
        const validatedTargets = new Set(
          validations
            .filter((row) =>
              ["VALIDATED", "PARTIALLY_VALIDATED"].includes(row.validation_result ?? ""),
            )
            .map((row) => row.target_id)
            .filter(Boolean),
        );
        const passed = targetIds.every((id) => validatedTargets.has(id));
        return {
          criterion_id: criterion.id,
          label: criterion.label,
          passed,
          detail: passed ? undefined : "Validate outcomes for all phase targets",
        };
      }
      default:
        return {
          criterion_id: criterion.id,
          label: criterion.label,
          passed: phaseEvidence.length > 0,
          detail: phaseEvidence.length > 0 ? undefined : "Submit phase evidence",
        };
    }
  });

  const readinessScore = scoreFromCriteria(criteriaResults);
  const gateResult = gateResultFromScore(readinessScore);
  const blockingReasons = criteriaResults
    .filter((row) => !row.passed)
    .map((row) => row.detail ?? row.label);

  const [gateRow] = await db
    .insert(erectorPhaseGates)
    .values({
      user_id: input.userId,
      blueprint_id: input.blueprintId,
      phase_id: input.phaseId,
      phase_name: phase.name,
      archetype,
      gate_criteria: Object.fromEntries(
        criteriaResults.map((row) => [row.criterion_id, row.passed]),
      ),
      evidence_ids: phaseEvidence.map((row) => row.id),
      outcome_validation_ids: validations.map((row) => row.target_id).filter(Boolean) as string[],
      capability_gap_ids: blockingGaps.map((row) => row.id),
      false_progress_flags: openFlags.map((row) => row.id),
      readiness_score: readinessScore,
      gate_result: gateResult,
      blocking_reasons: blockingReasons,
    })
    .returning({ id: erectorPhaseGates.id });

  if (!gateRow) throw new Error("Failed to write phase gate evaluation");

  let correctionPathId: string | undefined;

  if (gateResult === "BLOCKED" && !input.skipCorrectionOpen) {
    correctionPathId = await openPhaseGateCorrection({
      userId: input.userId,
      blueprintId: input.blueprintId,
      phaseGateId: gateRow.id,
      blockingReasons,
    });

    await db
      .update(erectorPhaseGates)
      .set({ correction_path_id: correctionPathId })
      .where(eq(erectorPhaseGates.id, gateRow.id));

    await writeEvent({
      eventType: EVENT_TYPES.PHASE_GATE_FAILED,
      entityType: "erector_phase_gate",
      entityId: gateRow.id,
      userId: input.userId,
      blueprintId: input.blueprintId,
      payload: {
        phase_id: input.phaseId,
        readiness_score: readinessScore,
        correction_path_id: correctionPathId,
      },
      idempotencyKey: `phase_gate_failed:${gateRow.id}`,
    }).catch(() => null);
  }

  if (gateResult === "PASSED") {
    await db
      .update(phases)
      .set({ gate_passed: true })
      .where(eq(phases.id, input.phaseId));

    await writeEvent({
      eventType: EVENT_TYPES.PHASE_GATE_PASSED,
      entityType: "erector_phase_gate",
      entityId: gateRow.id,
      userId: input.userId,
      blueprintId: input.blueprintId,
      payload: {
        phase_id: input.phaseId,
        readiness_score: readinessScore,
      },
      idempotencyKey: `phase_gate_passed:${gateRow.id}`,
    }).catch(() => null);
  }

  return {
    phase_gate_id: gateRow.id,
    gate_result: gateResult,
    readiness_score: readinessScore,
    criteria_results: criteriaResults,
    blocking_reasons: blockingReasons,
    correction_path_id: correctionPathId,
  };
}

export async function getCurrentPhaseGateStatus(input: {
  userId: string;
  blueprintId: string;
}): Promise<{
  phase_id: string | null;
  phase_name: string | null;
  readiness_score: number | null;
  gate_result: string | null;
  complete: string[];
  still_needed: string[];
}> {
  const [blueprint] = await db
    .select({ current_phase_id: blueprints.current_phase_id })
    .from(blueprints)
    .where(and(eq(blueprints.id, input.blueprintId), eq(blueprints.user_id, input.userId)))
    .limit(1);

  if (!blueprint?.current_phase_id) {
    return {
      phase_id: null,
      phase_name: null,
      readiness_score: null,
      gate_result: null,
      complete: [],
      still_needed: [],
    };
  }

  const [latestGate] = await db
    .select()
    .from(erectorPhaseGates)
    .where(
      and(
        eq(erectorPhaseGates.blueprint_id, input.blueprintId),
        eq(erectorPhaseGates.phase_id, blueprint.current_phase_id),
      ),
    )
    .orderBy(desc(erectorPhaseGates.evaluated_at))
    .limit(1);

  if (!latestGate) {
    const [phase] = await db
      .select({ name: phases.name })
      .from(phases)
      .where(eq(phases.id, blueprint.current_phase_id))
      .limit(1);

    return {
      phase_id: blueprint.current_phase_id,
      phase_name: phase?.name ?? null,
      readiness_score: null,
      gate_result: null,
      complete: [],
      still_needed: ["Run a phase readiness evaluation"],
    };
  }

  const criteria = latestGate.gate_criteria as Record<string, boolean>;
  const complete = Object.entries(criteria)
    .filter(([, passed]) => passed)
    .map(([id]) => id);
  const stillNeeded = latestGate.blocking_reasons ?? [];

  return {
    phase_id: blueprint.current_phase_id,
    phase_name: latestGate.phase_name,
    readiness_score: latestGate.readiness_score,
    gate_result: latestGate.gate_result,
    complete,
    still_needed: stillNeeded,
  };
}
