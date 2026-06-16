/**
 * DOC22 Task 3 — correction routing matrix with severity thresholds.
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { EventType } from "../../types/eventContracts.js";
import type {
  FailureCategory,
  ClassificationSeverity,
} from "./failureTypes.js";
import type { RepeatFailureResult } from "./RepeatFailureDetector.js";

export const CORRECTION_ROUTES: Record<
  FailureCategory,
  {
    correctionType: string;
    secondaryCorrection?: string;
    minSeverity: ClassificationSeverity;
    targetEngine: string;
  }
> = {
  CLARITY_FAILURE: {
    correctionType: "clarification_task_requested",
    minSeverity: "MEDIUM",
    targetEngine: "TaskGenerationEngine",
  },
  CAPABILITY_FAILURE: {
    correctionType: "academy_task_requested",
    secondaryCorrection: "capability_review_requested",
    minSeverity: "MEDIUM",
    targetEngine: "Academy/Capability",
  },
  CAPACITY_FAILURE: {
    correctionType: "load_reduction_requested",
    minSeverity: "HIGH",
    targetEngine: "ControlEngine",
  },
  DEPENDENCY_FAILURE: {
    correctionType: "dependency_resolution_requested",
    minSeverity: "MEDIUM",
    targetEngine: "DependencyEngine",
  },
  MOTIVATION_FRICTION: {
    correctionType: "friction_adaptation_requested",
    minSeverity: "HIGH",
    targetEngine: "FrictionDetectionEngine",
  },
  SYSTEM_FRICTION: {
    correctionType: "system_repair_requested",
    minSeverity: "MEDIUM",
    targetEngine: "StateIntegrityEngine",
  },
  WRONG_PRIORITY: {
    correctionType: "priority_review_requested",
    minSeverity: "MEDIUM",
    targetEngine: "PriorityEngine",
  },
  OUTCOME_MISMATCH: {
    correctionType: "correction_task_requested",
    minSeverity: "HIGH",
    targetEngine: "OutcomeValidationEngine",
  },
  EXTERNAL_BLOCKER: {
    correctionType: "external_wait_requested",
    minSeverity: "MEDIUM",
    targetEngine: "TaskGenerationEngine",
  },
  PROOF_FAILURE: {
    correctionType: "evidence_clarification_requested",
    minSeverity: "MEDIUM",
    targetEngine: "FeedbackProcessingEngine",
  },
};

const CORRECTION_EVENT_MAP: Record<string, string> = {
  clarification_task_requested: EVENT_TYPES.CLARIFICATION_TASK_REQUESTED,
  academy_task_requested: EVENT_TYPES.ACADEMY_TASK_REQUESTED,
  capability_review_requested: EVENT_TYPES.CAPABILITY_REVIEW_REQUESTED,
  load_reduction_requested: EVENT_TYPES.LOAD_REDUCTION_REQUESTED,
  dependency_resolution_requested: EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED,
  friction_adaptation_requested: EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED,
  system_repair_requested: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
  priority_review_requested: EVENT_TYPES.PRIORITY_REVIEW_REQUESTED,
  correction_task_requested: EVENT_TYPES.CORRECTION_TASK_REQUESTED,
  evidence_clarification_requested: EVENT_TYPES.EVIDENCE_SUBMISSION_TASK_REQUESTED,
  external_wait_requested: EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED,
};

const SEVERITY_RANK: Record<ClassificationSeverity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

/** Maps engine correction routes to order task_type values. */
export function correctionTypeToTaskType(correctionType: string): string {
  if (
    correctionType.includes("clarification") ||
    correctionType.includes("evidence_clarification")
  ) {
    return "clarification";
  }
  if (correctionType.includes("academy")) return "academy";
  if (
    correctionType.includes("blocker") ||
    correctionType.includes("dependency") ||
    correctionType.includes("external_wait")
  ) {
    return "blocker_resolution";
  }
  if (correctionType.includes("review") || correctionType.includes("priority")) return "review";
  return "recovery";
}

function meetsSeverityThreshold(
  severity: ClassificationSeverity,
  minimum: ClassificationSeverity,
): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[minimum];
}

export async function routeCorrection(params: {
  primaryCategory: FailureCategory;
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  severity: ClassificationSeverity;
  repeat: RepeatFailureResult;
}): Promise<{ routed: boolean; correctionType: string; correctionTaskType: string }> {
  const route = CORRECTION_ROUTES[params.primaryCategory];
  const correctionType = route.correctionType;
  const correctionTaskType = correctionTypeToTaskType(correctionType);

  if (params.severity === "LOW") {
    return { routed: false, correctionType, correctionTaskType };
  }

  if (!meetsSeverityThreshold(params.severity, route.minSeverity)) {
    return { routed: false, correctionType, correctionTaskType };
  }

  const basePayload = {
    userId: params.userId,
    blueprintId: params.blueprintId,
    entityType: "feedback" as const,
    entityId: params.feedbackId,
  };

  const eventType = (CORRECTION_EVENT_MAP[correctionType] ??
    EVENT_TYPES.CLARIFICATION_TASK_REQUESTED) as EventType;

  await writeEvent({
    ...basePayload,
    eventType,
    payload: {
      primary_category: params.primaryCategory,
      correction_type: correctionType,
      severity: params.severity,
      repeat_failure: params.repeat.repeatFailure,
      order_id: params.orderId,
      skip_identical_regeneration: params.repeat.repeatFailure || params.repeat.forceClarityForSameOrder,
      target_engine: route.targetEngine,
    },
    idempotencyKey: `failure_correction:${params.feedbackId}:${correctionType}`,
  }).catch(() => null);

  if (route.secondaryCorrection) {
    const secondaryType = route.secondaryCorrection;
    await writeEvent({
      ...basePayload,
      eventType: (CORRECTION_EVENT_MAP[secondaryType] ?? EVENT_TYPES.CAPABILITY_REVIEW_REQUESTED) as EventType,
      payload: {
        primary_category: params.primaryCategory,
        source: "failure_classification",
      },
      idempotencyKey: `failure_secondary:${params.feedbackId}:${secondaryType}`,
    }).catch(() => null);
  }

  if (params.primaryCategory === "CAPACITY_FAILURE") {
    await writeEvent({
      userId: params.userId,
      blueprintId: params.blueprintId,
      entityType: "blueprint",
      entityId: params.blueprintId,
      eventType: EVENT_TYPES.ADAPTATION_REQUESTED,
      payload: { type: "reduce_load", source: "capacity_failure" },
      idempotencyKey: `load_reduction:${params.feedbackId}`,
    }).catch(() => null);
  }

  if (params.repeat.forceClarityForSameOrder) {
    await writeEvent({
      userId: params.userId,
      blueprintId: params.blueprintId,
      entityType: "order",
      entityId: params.orderId,
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      payload: {
        variation_required: true,
        task_variation_requested: true,
        skip_identical_regeneration: true,
        reason: "same_order_repeat_failure",
        force_category: "CLARITY_FAILURE",
      },
      idempotencyKey: `task_variation:${params.orderId}:${params.feedbackId}`,
    }).catch(() => null);
  }

  if (params.repeat.proofUxReviewRequired) {
    await writeEvent({
      userId: params.userId,
      blueprintId: params.blueprintId,
      entityType: "blueprint",
      entityId: params.blueprintId,
      eventType: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
      payload: {
        check_type: "PROOF_UX_REVIEW",
        reason: "system_friction_detected",
        proof_rejection_count: params.repeat.proofRejectedCount,
      },
      idempotencyKey: `proof_ux_review:${params.blueprintId}`,
    }).catch(() => null);
  }

  return { routed: true, correctionType, correctionTaskType };
}

export async function emitFailureCorrectionEvents(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  primaryCategory: FailureCategory;
  severity: ClassificationSeverity;
  repeat: RepeatFailureResult;
}): Promise<void> {
  await routeCorrection(params);
}
