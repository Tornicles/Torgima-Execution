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
    case "FATIGUE_RISK":
    case "BURNOUT_RISK":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.ADAPTATION_REQUESTED,
        payload: {
          type: "reduce_load",
          target: "ControlEngine",
          risk_score: params.riskScore,
          pattern_id: params.patternId,
        },
        idempotencyKey: `adaptation_reduce_load:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
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
      break;
    case "TASK_TYPE_AVOIDANCE":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED,
        payload: { reason: "task_type_avoidance", pattern: params.pattern },
        idempotencyKey: `friction_avoid:${params.blueprintId}`,
      }).catch(() => null);
      break;
    case "LOW_VALUE_COMPLETION":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.PRIORITY_REVIEW_REQUESTED,
        payload: { pattern: params.pattern },
        idempotencyKey: `priority_review:${params.blueprintId}:low_value`,
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
      break;
    case "VOLATILE_EXECUTION":
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.CONDITION_EVALUATION_REQUESTED,
        payload: { trigger: "volatile_execution" },
        idempotencyKey: `condition_eval:volatile:${params.blueprintId}`,
      }).catch(() => null);
      break;
    default:
      break;
  }
}
