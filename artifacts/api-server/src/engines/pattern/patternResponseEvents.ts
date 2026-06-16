/**
 * Phase 4 DOC 21 — pattern type → downstream events.
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { PatternSpecLabel } from "./PatternLearningEngine.js";

export async function emitPatternResponseEvent(params: {
  pattern: PatternSpecLabel;
  userId: string;
  blueprintId: string;
  patternId?: string;
  riskScore?: number;
}): Promise<void> {
  const base = {
    userId: params.userId,
    blueprintId: params.blueprintId,
    entityType: "blueprint" as const,
    entityId: params.blueprintId,
  };

  switch (params.pattern) {
    case "DELAY_PATTERN":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.ADAPTATION_REQUESTED,
        payload: {
          type: "TIMING_FRICTION",
          target: "ControlEngine",
          pattern_id: params.patternId,
        },
        idempotencyKey: `adaptation_timing:${params.blueprintId}`,
      }).catch(() => null);
      break;
    case "FATIGUE_RISK":
    case "BURNOUT_RISK":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.LOAD_REDUCTION_REQUESTED,
        payload: {
          reason: "fatigue_risk",
          target: "ControlEngine",
          risk_score: params.riskScore,
          pattern_id: params.patternId,
        },
        idempotencyKey: `load_reduction_pattern:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
      }).catch(() => null);
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.CONDITION_EVALUATION_REQUESTED,
        payload: { trigger: "fatigue_risk", pattern_id: params.patternId },
        idempotencyKey: `condition_eval:fatigue:${params.blueprintId}`,
      }).catch(() => null);
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED,
        payload: { reason: "fatigue_risk", action: "reduce_load" },
        idempotencyKey: `friction_adapt:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
      }).catch(() => null);
      break;
    case "DIFFICULTY_FAILURE":
    case "DIFFICULTY_CEILING":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.CAPABILITY_REVIEW_REQUESTED,
        payload: { pattern: params.pattern },
        idempotencyKey: `capability_review:${params.blueprintId}:${params.pattern}`,
      }).catch(() => null);
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.ADAPTATION_REQUESTED,
        payload: {
          type: "DIFFICULTY_DOWNGRADE",
          pattern: params.pattern,
          target: "ControlEngine",
        },
        idempotencyKey: `difficulty_downgrade:${params.blueprintId}:${params.pattern}`,
      }).catch(() => null);
      break;
    case "TASK_TYPE_AVOIDANCE":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.ADAPTATION_REQUESTED,
        payload: {
          type: "FRICTION_REVIEW",
          pattern: params.pattern,
          target: "ControlEngine",
        },
        idempotencyKey: `friction_review:${params.blueprintId}`,
      }).catch(() => null);
      break;
    case "LOW_VALUE_COMPLETION":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.PRIORITY_REVIEW_REQUESTED,
        payload: { pattern: params.pattern },
        idempotencyKey: `priority_review:${params.blueprintId}:low_value`,
      }).catch(() => null);
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.OUTCOME_VALIDATION_REQUESTED,
        payload: { trigger: "outcome_correction", pattern: params.pattern },
        idempotencyKey: `outcome_correction:${params.blueprintId}`,
      }).catch(() => null);
      break;
    case "ABANDONMENT_RISK":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.RECOVERY_TASK_REQUESTED,
        payload: { pattern: params.pattern },
        idempotencyKey: `recovery_task:${params.blueprintId}:abandonment`,
      }).catch(() => null);
      break;
    case "RECOVERY_SUCCESS":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.RECOVERY_PATTERN_LEARNED,
        payload: { pattern_id: params.patternId },
        idempotencyKey: `recovery_pattern:${params.blueprintId}:${Date.now()}`,
      }).catch(() => null);
      break;
    case "CONSISTENT_EXECUTION":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.IDENTITY_EVALUATION_REQUESTED,
        payload: { reason: "consistent_execution", window_days: 14 },
        idempotencyKey: `identity:consistent:${params.blueprintId}`,
      }).catch(() => null);
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.CAPABILITY_REVIEW_REQUESTED,
        payload: { reason: "consistent_execution" },
        idempotencyKey: `capability:consistent:${params.blueprintId}`,
      }).catch(() => null);
      break;
    case "VOLATILE_EXECUTION":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.ADAPTATION_REQUESTED,
        payload: {
          type: "STABILIZATION",
          trigger: "volatile_execution",
          target: "ControlEngine",
        },
        idempotencyKey: `stabilization:${params.blueprintId}`,
      }).catch(() => null);
      break;
    default:
      break;
  }
}
