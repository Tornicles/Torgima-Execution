import { and, eq } from "drizzle-orm";
import {
  blueprints,
  db,
  erectorCapabilityProfiles,
  erectorEvidenceLedger,
  erectorPhaseGates,
  falseProgressFlags,
  outcomeValidations,
} from "@workspace/db";
import { TorgimaError } from "../../lib/errors.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { ValidationStatus } from "../outcome/outcomeTypes.js";

export interface BlockingResult {
  blocked: boolean;
  reason?: string;
  code?: string;
}

function severityRank(value: string | null | undefined): number {
  const normalized = (value ?? "low").toLowerCase();
  if (normalized === "critical") return 4;
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;
  return 0;
}

export async function enforceTargetCompletion(input: {
  blueprintId: string;
  userId: string;
  validationStatus: ValidationStatus;
}): Promise<BlockingResult> {
  const allowed = new Set<ValidationStatus>(["VALIDATED", "PARTIALLY_VALIDATED"]);
  if (allowed.has(input.validationStatus)) {
    return { blocked: false };
  }

  return {
    blocked: true,
    code: "TARGET_COMPLETION_BLOCKED",
    reason: "Target completion requires validated or partially validated outcome evidence",
  };
}

export async function enforcePhaseAdvancement(input: {
  blueprintId: string;
  userId: string;
}): Promise<BlockingResult> {
  const openFlags = await db
    .select()
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, input.blueprintId),
        eq(falseProgressFlags.resolved, false),
      ),
    );

  const severeFlag = openFlags.find((flag) => severityRank(flag.severity) >= 3);
  if (severeFlag) {
    await writeEvent({
      eventType: EVENT_TYPES.ADVANCEMENT_BLOCKED,
      entityType: "blueprint",
      entityId: input.blueprintId,
      userId: input.userId,
      blueprintId: input.blueprintId,
      payload: {
        reason: "false_progress_flag",
        flag_type: severeFlag.detection_type,
        severity: severeFlag.severity,
      },
      idempotencyKey: `advancement_blocked:${input.blueprintId}:${severeFlag.id}`,
    }).catch(() => null);

    return {
      blocked: true,
      code: "PHASE_ADVANCEMENT_BLOCKED",
      reason: `Phase advancement blocked by ${severeFlag.detection_type} false progress flag`,
    };
  }

  const [blockedGate] = await db
    .select({ id: erectorPhaseGates.id })
    .from(erectorPhaseGates)
    .where(
      and(
        eq(erectorPhaseGates.blueprint_id, input.blueprintId),
        eq(erectorPhaseGates.gate_result, "BLOCKED"),
      ),
    )
    .limit(1);

  if (blockedGate) {
    await writeEvent({
      eventType: EVENT_TYPES.ADVANCEMENT_BLOCKED,
      entityType: "blueprint",
      entityId: input.blueprintId,
      userId: input.userId,
      blueprintId: input.blueprintId,
      payload: { reason: "phase_gate_blocked", gate_id: blockedGate.id },
      idempotencyKey: `advancement_blocked:${input.blueprintId}:phase_gate`,
    }).catch(() => null);

    return {
      blocked: true,
      code: "PHASE_ADVANCEMENT_BLOCKED",
      reason: "Phase advancement blocked by erector phase gate",
    };
  }

  return { blocked: false };
}

export async function enforceOutcomeReward(input: {
  blueprintId: string;
  userId: string;
  validationStatus: ValidationStatus;
}): Promise<BlockingResult> {
  const blockedStatuses = new Set<ValidationStatus>([
    "UNVALIDATED",
    "CONTRADICTED",
    "FALSE_PROGRESS",
  ]);

  if (!blockedStatuses.has(input.validationStatus)) {
    return { blocked: false };
  }

  await writeEvent({
    eventType: EVENT_TYPES.REWARD_EVALUATION_BLOCKED,
    entityType: "blueprint",
    entityId: input.blueprintId,
    userId: input.userId,
    blueprintId: input.blueprintId,
    payload: { validation_status: input.validationStatus },
    idempotencyKey: `reward_evaluation_blocked:${input.blueprintId}:${input.validationStatus}`,
  }).catch(() => null);

  return {
    blocked: true,
    code: "REWARD_EVALUATION_BLOCKED",
    reason: `Reward blocked for validation status ${input.validationStatus}`,
  };
}

export async function enforceIdentityAdvancement(input: {
  blueprintId: string;
  userId: string;
}): Promise<BlockingResult> {
  const openFlags = await db
    .select()
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, input.blueprintId),
        eq(falseProgressFlags.resolved, false),
      ),
    );

  const identityBlockingTypes = new Set(["CLAIM_CONTRADICTED", "ACTIVITY_WITHOUT_OUTCOME"]);
  const identityBlockFlag = openFlags.find(
    (flag) =>
      identityBlockingTypes.has(flag.detection_type) ||
      severityRank(flag.severity) >= 4,
  );

  if (!identityBlockFlag) {
    return { blocked: false };
  }

  await writeEvent({
    eventType: EVENT_TYPES.IDENTITY_ADVANCEMENT_BLOCKED,
    entityType: "blueprint",
    entityId: input.blueprintId,
    userId: input.userId,
    blueprintId: input.blueprintId,
    payload: {
      flag_type: identityBlockFlag.detection_type,
      false_progress_score: identityBlockFlag.false_progress_score,
    },
    idempotencyKey: `identity_advancement_blocked:${input.blueprintId}:${identityBlockFlag.id}`,
  }).catch(() => null);

  return {
    blocked: true,
    code: "IDENTITY_ADVANCEMENT_BLOCKED",
    reason: `Identity advancement blocked by ${identityBlockFlag.detection_type} false progress flag`,
  };
}

export async function enforceCapabilityUpgrade(input: {
  blueprintId: string;
  userId: string;
  capabilityId: string;
}): Promise<BlockingResult> {
  const [ledgerProof] = await db
    .select({ id: erectorEvidenceLedger.id })
    .from(erectorEvidenceLedger)
    .where(
      and(
        eq(erectorEvidenceLedger.user_id, input.userId),
        eq(erectorEvidenceLedger.blueprint_id, input.blueprintId),
      ),
    )
    .limit(1);

  const [capabilityProfile] = await db
    .select({ proof_level: erectorCapabilityProfiles.proof_level })
    .from(erectorCapabilityProfiles)
    .where(
      and(
        eq(erectorCapabilityProfiles.user_id, input.userId),
        eq(erectorCapabilityProfiles.capability_id, input.capabilityId),
      ),
    )
    .limit(1);

  if (ledgerProof && capabilityProfile?.proof_level === "proven") {
    return { blocked: false };
  }

  return {
    blocked: true,
    code: "CAPABILITY_UPGRADE_BLOCKED",
    reason: "Capability upgrade requires proven evidence in the erector evidence ledger",
  };
}

export function enforceDashboardSuccessCopy(
  validationStatus: ValidationStatus,
): BlockingResult {
  if (validationStatus === "VALIDATED") {
    return { blocked: false };
  }

  return {
    blocked: true,
    code: "DASHBOARD_SUCCESS_BLOCKED",
    reason: "Evidence needed before celebration copy can be shown",
  };
}

export async function assertTargetCompletionAllowed(input: {
  blueprintId: string;
  userId: string;
}): Promise<void> {
  const [latest] = await db
    .select({ verdict: outcomeValidations.verdict })
    .from(outcomeValidations)
    .where(eq(outcomeValidations.blueprint_id, input.blueprintId))
    .limit(1);

  const result = await enforceTargetCompletion({
    blueprintId: input.blueprintId,
    userId: input.userId,
    validationStatus: (latest?.verdict as ValidationStatus | undefined) ?? "UNVALIDATED",
  });

  if (result.blocked) {
    throw new TorgimaError("VALIDATION_ERROR", result.reason ?? "Blocked", false);
  }
}

export async function loadBlueprintArchetype(blueprintId: string): Promise<string | null> {
  const [row] = await db
    .select({ erector_archetype: blueprints.erector_archetype })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return row?.erector_archetype ?? null;
}
