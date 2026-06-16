/**
 * DOC25 Task 2 — adaptation matrix, routing, and boundary enforcement.
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { EventType } from "../../types/eventContracts.js";
import type {
  Doc25FrictionType,
  FrictionContext,
  FrictionSeverity,
} from "./frictionTypes.js";

export const ADAPTATION_MATRIX: Record<
  Doc25FrictionType,
  { event: string; target: string; action: string }
> = {
  CLARITY_FRICTION: {
    event: "clarification_task_requested",
    target: "TaskGenerationEngine",
    action: "Generate a clarification task that asks exactly what was unclear",
  },
  SIZE_FRICTION: {
    event: "task_split_requested",
    target: "TaskGenerationEngine",
    action: "Split the current task into 2 smaller steps with shorter time estimates",
  },
  DIFFICULTY_FRICTION: {
    event: "difficulty_downgrade_requested",
    target: "ControlEngine",
    action: "Temporarily cap difficulty 1 level lower for next 3 tasks",
  },
  TIMING_FRICTION: {
    event: "timing_adaptation_requested",
    target: "TaskGenerationEngine",
    action: "Reduce task scope OR reframe task for shorter time windows",
  },
  DEPENDENCY_FRICTION: {
    event: "dependency_resolution_requested",
    target: "DependencyEngine",
    action: "Create dependency resolution task and block original task",
  },
  COGNITIVE_FRICTION: {
    event: "simplification_requested",
    target: "SimplificationEngine",
    action: "Reduce decision count and simplify next task presentation",
  },
  EMOTIONAL_FRICTION: {
    event: "recovery_task_requested",
    target: "TaskGenerationEngine",
    action: "Generate recovery or low-stakes task with identity reinforcement",
  },
  SYSTEM_FRICTION: {
    event: "system_repair_requested",
    target: "StateIntegrityEngine",
    action: "Trigger integrity check and notify frontend of potential state issue",
  },
  OUTCOME_FRICTION: {
    event: "priority_review_requested",
    target: "PriorityEngine",
    action: "Review if current tasks align with active target — may need reorientation",
  },
};

const ADAPTATION_EVENT_MAP: Record<string, EventType> = {
  clarification_task_requested: EVENT_TYPES.CLARIFICATION_TASK_REQUESTED,
  task_split_requested: EVENT_TYPES.TASK_SPLIT_REQUESTED,
  difficulty_downgrade_requested: EVENT_TYPES.DIFFICULTY_DOWNGRADE_REQUESTED,
  timing_adaptation_requested: EVENT_TYPES.TIMING_ADAPTATION_REQUESTED,
  dependency_resolution_requested: EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED,
  simplification_requested: EVENT_TYPES.REDUCE_DECISION_BURDEN_REQUESTED,
  recovery_task_requested: EVENT_TYPES.RECOVERY_TASK_REQUESTED,
  system_repair_requested: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
  priority_review_requested: EVENT_TYPES.PRIORITY_REVIEW_REQUESTED,
  root_cause_review_requested: EVENT_TYPES.ROOT_CAUSE_REVIEW_REQUESTED,
};

export const ADAPTATION_CYCLE_LIMIT = 3;

export type AdaptationRouteResult = {
  routed: boolean;
  adaptationEvent: string;
  target: string;
  rootCauseReview: boolean;
  skippedReason?: string;
};

/** Boundary rule 3 — repeated adaptation without improvement. */
export function shouldTriggerRootCauseReview(
  frictionType: Doc25FrictionType,
  adaptationCycleCount: Record<string, number>,
): boolean {
  return (adaptationCycleCount[frictionType] ?? 0) >= ADAPTATION_CYCLE_LIMIT;
}

/** Boundary rule 1 — never increase difficulty when friction severity is HIGH+. */
export function adaptationIncreasesDifficulty(eventName: string): boolean {
  return eventName.includes("upgrade") || eventName.includes("increase_difficulty");
}

/** Boundary rule 4 — SYSTEM_FRICTION never routes to user correction tasks. */
export function isUserCorrectionTaskEvent(eventName: string): boolean {
  return (
    eventName === "correction_task_requested" ||
    eventName === EVENT_TYPES.CORRECTION_TASK_REQUESTED
  );
}

export function resolveAdaptationEvent(params: {
  frictionType: Doc25FrictionType;
  severity: FrictionSeverity;
  adaptationCycleCount?: Record<string, number>;
}): { event: string; target: string; action: string; rootCauseReview: boolean } {
  const matrix = ADAPTATION_MATRIX[params.frictionType];
  const cycles = params.adaptationCycleCount ?? {};

  if (shouldTriggerRootCauseReview(params.frictionType, cycles)) {
    return {
      event: "root_cause_review_requested",
      target: "PatternLearningEngine",
      action: "Escalate repeated friction to root cause review",
      rootCauseReview: true,
    };
  }

  if (
    ["HIGH", "CRITICAL"].includes(params.severity) &&
    adaptationIncreasesDifficulty(matrix.event)
  ) {
    return {
      event: matrix.event,
      target: matrix.target,
      action: matrix.action,
      rootCauseReview: false,
    };
  }

  return { ...matrix, rootCauseReview: false };
}

export async function routeAdaptation(params: {
  frictionType: Doc25FrictionType;
  severity: FrictionSeverity;
  context: FrictionContext;
  adaptationCycleCount?: Record<string, number>;
  reason?: string;
}): Promise<AdaptationRouteResult> {
  const resolved = resolveAdaptationEvent({
    frictionType: params.frictionType,
    severity: params.severity,
    adaptationCycleCount: params.adaptationCycleCount,
  });

  if (
    params.frictionType === "SYSTEM_FRICTION" &&
    isUserCorrectionTaskEvent(resolved.event)
  ) {
    return {
      routed: false,
      adaptationEvent: resolved.event,
      target: resolved.target,
      rootCauseReview: false,
      skippedReason: "system_friction_never_correction_task",
    };
  }

  if (
    ["HIGH", "CRITICAL"].includes(params.severity) &&
    adaptationIncreasesDifficulty(resolved.event)
  ) {
    return {
      routed: false,
      adaptationEvent: resolved.event,
      target: resolved.target,
      rootCauseReview: false,
      skippedReason: "high_friction_never_increase_difficulty",
    };
  }

  const eventType =
    ADAPTATION_EVENT_MAP[resolved.event] ?? EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED;

  await writeEvent({
    eventType,
    entityType: params.context.feedbackId ? "feedback" : "blueprint",
    entityId: params.context.feedbackId ?? params.context.blueprintId,
    userId: params.context.userId,
    blueprintId: params.context.blueprintId,
    payload: {
      friction_type: params.frictionType,
      severity: params.severity,
      adaptation_event: resolved.event,
      target_engine: resolved.target,
      action: resolved.action,
      reason: params.reason,
      root_cause_review: resolved.rootCauseReview,
      enforcement_respected: true,
      proof_requirements_preserved: true,
      order_id: params.context.orderId,
      feedback_id: params.context.feedbackId,
    },
    idempotencyKey: `friction_adapt:${params.context.blueprintId}:${params.frictionType}:${resolved.event}:${params.context.feedbackId ?? "window"}`,
  }).catch(() => null);

  return {
    routed: true,
    adaptationEvent: resolved.event,
    target: resolved.target,
    rootCauseReview: resolved.rootCauseReview,
  };
}
