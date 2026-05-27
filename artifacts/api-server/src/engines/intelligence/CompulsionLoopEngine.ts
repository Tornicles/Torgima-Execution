/**
 * Prompt 7 §3.1 / TORGIMA upgrade P1 — cue → action → proof → reward → identity → next action.
 * Records operating-loop stages; does not bypass control or invent rewards.
 */

import { db, feedback } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recordOperatingLoopStage } from "../../services/OperatingLoopRecorder.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { logger } from "../../lib/logger.js";
import { isVerifiedFeedbackEvidence } from "./IdentityContinuityEngine.js";

import type { OperatingLoopStageKey } from "../../services/OperatingLoopRecorder.js";

export type CompulsionLoopStage =
  | "REALITY_EXECUTION_RECORDED"
  | "PROOF_FEEDBACK_INGESTED"
  | "SIGNAL_RECALCULATION_ENQUEUED"
  | "TASK_GENERATION_COMPLETED";

export async function recordCompulsionLoopStage(params: {
  blueprintId: string;
  userId: string;
  stage: CompulsionLoopStage;
  entityType?: string;
  entityId?: string;
  causationEventId?: string;
  correlation?: Record<string, unknown>;
}): Promise<void> {
  const descriptions: Record<CompulsionLoopStage, string> = {
    REALITY_EXECUTION_RECORDED: "Proof and feedback recorded for the compulsion loop.",
    PROOF_FEEDBACK_INGESTED: "Feedback ingested; outcome validation may run on completed work.",
    SIGNAL_RECALCULATION_ENQUEUED: "Signals recalculated after verified execution.",
    TASK_GENERATION_COMPLETED: "Next action guaranteed by task generation.",
  };

  await recordOperatingLoopStage({
    blueprintId: params.blueprintId,
    userId: params.userId,
    stage: params.stage as OperatingLoopStageKey,
    description: descriptions[params.stage],
    causationEventId: params.causationEventId,
    entityType: params.entityType,
    entityId: params.entityId,
    correlation: params.correlation,
  }).catch((err) => {
    logger.warn({ err, stage: params.stage }, "[CompulsionLoop] Stage record failed");
  });
}

/** TORGIMA P1 — fires reward, identity, task guarantee, and dashboard refresh after verified feedback. */
export async function fireCompulsionLoop(params: {
  userId: string;
  blueprintId: string;
  feedbackId: string;
  causationEventId?: string;
}): Promise<void> {
  const [fb] = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, params.feedbackId))
    .limit(1);

  if (!fb) {
    logger.warn({ feedbackId: params.feedbackId }, "[CompulsionLoop] Feedback not found");
    return;
  }

  const accepted =
    isVerifiedFeedbackEvidence(fb) &&
    (fb.completion_status === "completed" || fb.completion_status === "partial");

  if (!accepted) {
    logger.info(
      { feedbackId: params.feedbackId, validity: fb.validity, status: fb.completion_status },
      "[CompulsionLoop] Skipped — feedback not accepted for loop",
    );
    return;
  }

  await writeEvent({
    eventType: EVENT_TYPES.REWARD_EVALUATION_REQUESTED,
    entityType: "feedback",
    entityId: params.feedbackId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      source_type: "FEEDBACK",
      source_id: params.feedbackId,
      source_event_id: params.feedbackId,
      completion: fb.completion_status,
      idempotency_key: `reward:feedback:${params.feedbackId}`,
    },
    idempotencyKey: `reward:${params.feedbackId}`,
    causationEventId: params.causationEventId,
  });

  await writeEvent({
    eventType: EVENT_TYPES.IDENTITY_EVALUATION_REQUESTED,
    entityType: "feedback",
    entityId: params.feedbackId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      reason: "compulsion_loop",
      source_feedback_id: params.feedbackId,
      window_days: 30,
    },
    idempotencyKey: `identity:compulsion:${params.feedbackId}`,
    causationEventId: params.causationEventId,
  });

  const { ensureActiveOrder } = await import("../task-guarantee/ContinuousTaskGuaranteeEngine.js");
  await ensureActiveOrder(params.userId).catch((err) => {
    logger.warn({ err, blueprintId: params.blueprintId }, "[CompulsionLoop] Task guarantee check failed");
  });

  await writeEvent({
    eventType: EVENT_TYPES.DASHBOARD_REFRESH_REQUESTED,
    entityType: "blueprint",
    entityId: params.blueprintId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: { trigger: "compulsion_loop", feedback_id: params.feedbackId },
    idempotencyKey: `dashboard_refresh:compulsion:${params.feedbackId}`,
    causationEventId: params.causationEventId,
  });

  await recordCompulsionLoopStage({
    blueprintId: params.blueprintId,
    userId: params.userId,
    stage: "PROOF_FEEDBACK_INGESTED",
    entityType: "feedback",
    entityId: params.feedbackId,
    causationEventId: params.causationEventId,
  });
}
