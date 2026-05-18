import { db, feedback, orders } from "@workspace/db";
import { eq } from "drizzle-orm";
import { enterLoop } from "./ExecutionLoopEngine.js";
import { generateNextTask } from "./generateNextTask.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

export interface FeedbackSubmission {
  userId: string;
  blueprintId: string;
  orderId: string;
  completionStatus: string;
  feedbackText?: string;
  score?: number;
}

export interface PrimaryLoopResult {
  feedbackId?: string;
  queued: boolean;
  nextOrderId?: string;
  generationMs?: number;
}

/**
 * Primary loop entry (Prompt 5): persist feedback, enqueue signal chain, attempt immediate next task.
 * Event workers handle signal → condition → control; generateNextTask provides synchronous fallback.
 */
export async function runPrimaryLoop(
  userId: string,
  data: FeedbackSubmission,
): Promise<PrimaryLoopResult> {
  const start = Date.now();

  const [fb] = await db
    .insert(feedback)
    .values({
      user_id: userId,
      blueprint_id: data.blueprintId,
      order_id: data.orderId,
      completion_status: data.completionStatus as typeof feedback.$inferInsert.completion_status,
      reflection: data.feedbackText ?? "",
      score: data.score,
    })
    .returning({ id: feedback.id });

  await db
    .update(orders)
    .set({
      status: data.completionStatus === "completed" ? "completed" : "failed",
      finished_at: new Date(),
    })
    .where(eq(orders.id, data.orderId));

  const eventId = await writeEvent({
    eventType: EVENT_TYPES.FEEDBACK_SUBMITTED,
    entityType: "feedback",
    entityId: fb?.id ?? data.orderId,
    userId,
    blueprintId: data.blueprintId,
    payload: {
      feedback_id: fb?.id,
      order_id: data.orderId,
      completion_status: data.completionStatus,
    },
    idempotencyKey: `feedback:${fb?.id ?? data.orderId}`,
  });

  await enterLoop({
    blueprintId: data.blueprintId,
    userId,
    trigger: "feedback_submitted",
    generationMode: "post_feedback",
    causationEventId: eventId,
  });

  const next = await generateNextTask(userId, {
    blueprintId: data.blueprintId,
    reason: "FEEDBACK_COMPLETE",
    generationMode: "post_feedback",
  });

  return {
    feedbackId: fb?.id,
    queued: true,
    nextOrderId: next.order?.id,
    generationMs: Date.now() - start,
  };
}
