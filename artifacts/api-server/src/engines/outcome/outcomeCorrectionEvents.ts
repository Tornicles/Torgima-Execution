/**
 * Phase 3 DOC 20 — correction event routing from validation status.
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { ValidationStatus } from "./OutcomeValidationEngine.js";
import type { FalseProgressPattern } from "../intelligence/FalseProgressDetectionEngine.js";

export async function emitOutcomeCorrectionEvents(params: {
  userId: string;
  blueprintId: string;
  status: ValidationStatus;
  pattern?: FalseProgressPattern | null;
  targetId?: string;
  sourceId?: string;
}): Promise<void> {
  const base = {
    userId: params.userId,
    blueprintId: params.blueprintId,
    entityType: "blueprint" as const,
    entityId: params.blueprintId,
  };

  if (params.status === "NEEDS_MORE_EVIDENCE") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.OUTCOME_NEEDS_EVIDENCE,
      payload: {
        target_id: params.targetId,
        source_id: params.sourceId,
      },
      idempotencyKey: `outcome_needs_evidence:${params.blueprintId}:${params.sourceId ?? "x"}`,
    }).catch(() => null);

    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.EVIDENCE_SUBMISSION_TASK_REQUESTED,
      payload: { target_id: params.targetId },
      idempotencyKey: `evidence_task:${params.blueprintId}:${params.sourceId ?? "x"}`,
    }).catch(() => null);
    return;
  }

  if (params.status === "CONTRADICTED" || params.status === "FALSE_PROGRESS") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.FALSE_PROGRESS_DETECTED,
      payload: { pattern: params.pattern, target_id: params.targetId },
      idempotencyKey: `false_progress:${params.blueprintId}:${params.pattern ?? "generic"}`,
    }).catch(() => null);

    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.CORRECTION_TASK_REQUESTED,
      payload: {
        correction_type: params.pattern ?? "evidence_submission",
        target_id: params.targetId,
      },
      idempotencyKey: `correction_task:${params.blueprintId}:${params.sourceId ?? params.pattern}`,
    }).catch(() => null);
    return;
  }

  if (params.pattern === "WRONG_WORK") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.ADVANCEMENT_BLOCKED,
      payload: { reason: "wrong_work", target_id: params.targetId },
      idempotencyKey: `advancement_blocked:${params.blueprintId}:wrong_work`,
    }).catch(() => null);

    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.REFOCUS_TASK_REQUESTED,
      payload: { target_id: params.targetId },
      idempotencyKey: `refocus_task:${params.blueprintId}:${params.targetId}`,
    }).catch(() => null);
    return;
  }

  if (params.pattern === "AVOIDANCE_LOOP") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED,
      payload: { target_id: params.targetId },
      idempotencyKey: `dependency_resolution:${params.blueprintId}:avoidance`,
    }).catch(() => null);

    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.PRIORITY_REVIEW_REQUESTED,
      payload: { blueprint_id: params.blueprintId },
      idempotencyKey: `priority_review:${params.blueprintId}`,
    }).catch(() => null);
  }
}
