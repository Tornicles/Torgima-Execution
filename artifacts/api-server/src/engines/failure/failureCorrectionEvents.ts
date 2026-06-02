/**
 * Phase 4 DOC 22 — emit primary correction events from classification result.
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { EventType } from "../../types/eventContracts.js";
import type { ClassificationResult } from "./FailureClassificationEngine.js";

const CORRECTION_EVENT_MAP: Record<string, string> = {
  clarification_task_requested: EVENT_TYPES.CLARIFICATION_TASK_REQUESTED,
  academy_task_requested: EVENT_TYPES.ACADEMY_TASK_REQUESTED,
  load_reduction_requested: EVENT_TYPES.LOAD_REDUCTION_REQUESTED,
  dependency_resolution_requested: EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED,
  friction_adaptation_requested: EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED,
  system_repair_requested: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
  priority_review_requested: EVENT_TYPES.PRIORITY_REVIEW_REQUESTED,
  correction_task_requested: EVENT_TYPES.CORRECTION_TASK_REQUESTED,
  evidence_clarification_requested: EVENT_TYPES.EVIDENCE_SUBMISSION_TASK_REQUESTED,
  external_wait_requested: EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED,
};

export async function emitFailureCorrectionEvents(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  result: ClassificationResult;
}): Promise<void> {
  const eventType = (CORRECTION_EVENT_MAP[params.result.correctionType] ??
    EVENT_TYPES.CLARIFICATION_TASK_REQUESTED) as EventType;

  await writeEvent({
    eventType,
    entityType: "feedback",
    entityId: params.feedbackId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      primary_category: params.result.primaryCategory,
      correction_type: params.result.correctionType,
      severity: params.result.severity,
      repeat_failure: params.result.repeatFailure,
      order_id: params.orderId,
      skip_identical_regeneration: params.result.repeatFailure,
    },
    idempotencyKey: `failure_correction:${params.feedbackId}:${params.result.correctionType}`,
  }).catch(() => null);

  if (params.result.primaryCategory === "CAPACITY_FAILURE") {
    await writeEvent({
      eventType: EVENT_TYPES.ADAPTATION_REQUESTED,
      entityType: "blueprint",
      entityId: params.blueprintId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: { type: "reduce_load", source: "capacity_failure" },
      idempotencyKey: `load_reduction:${params.feedbackId}`,
    }).catch(() => null);
  }
}
