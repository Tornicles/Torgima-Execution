import { db, feedback, orders } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { TorgimaError } from "../../lib/errors.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { dispatchPendingEvents } from "../../services/EventDispatcher.js";
import { recordOperatingLoopStage } from "../../services/OperatingLoopRecorder.js";

export async function answerInterrogation(params: {
  feedbackId: string;
  userId: string;
  answer: string;
  idempotencyKey: string;
}): Promise<{ feedbackId: string; eventId: string; resumed: boolean }> {
  const [row] = await db
    .select({
      id: feedback.id,
      order_id: feedback.order_id,
      blueprint_id: feedback.blueprint_id,
      user_id: feedback.user_id,
      interrogation_json: feedback.interrogation_json,
      reflection: feedback.reflection,
    })
    .from(feedback)
    .where(and(eq(feedback.id, params.feedbackId), eq(feedback.user_id, params.userId)))
    .limit(1);

  if (!row) {
    throw new TorgimaError("NOT_FOUND", "Feedback not found", false);
  }

  const interrogation = (row.interrogation_json ?? {}) as Record<string, unknown>;
  if (interrogation["answered_at"]) {
    return { feedbackId: row.id, eventId: String(interrogation["resume_event_id"] ?? ""), resumed: true };
  }

  const mergedReflection = `${row.reflection ?? ""}\n\n[Interrogation answer]: ${params.answer}`.trim();

  await db
    .update(feedback)
    .set({
      reflection: mergedReflection,
      interrogation_json: {
        ...interrogation,
        answer: params.answer,
        answered_at: new Date().toISOString(),
        requires_interrogation: false,
      },
    })
    .where(eq(feedback.id, row.id));

  await db
    .update(orders)
    .set({ status: "needs_feedback" })
    .where(eq(orders.id, row.order_id));

  const eventId = await writeEvent({
    eventType: EVENT_TYPES.INTERROGATION_ANSWERED,
    entityType: "feedback",
    entityId: row.id,
    userId: params.userId,
    blueprintId: row.blueprint_id,
    payload: {
      feedback_id: row.id,
      order_id: row.order_id,
      answer: params.answer,
      idempotency_key: params.idempotencyKey,
    },
    idempotencyKey: `interrogation_answered:${row.id}:${params.idempotencyKey}`,
  });

  await db
    .update(feedback)
    .set({
      interrogation_json: {
        ...interrogation,
        answer: params.answer,
        answered_at: new Date().toISOString(),
        requires_interrogation: false,
        resume_event_id: eventId,
      },
    })
    .where(eq(feedback.id, row.id));

  await recordOperatingLoopStage({
    blueprintId: row.blueprint_id,
    userId: params.userId,
    stage: "OPERATING_FEEDBACK_CLOSED",
    description: `Interrogation answered for feedback ${row.id}; primary loop resuming.`,
    causationEventId: eventId,
    triggerEventType: EVENT_TYPES.INTERROGATION_ANSWERED,
    entityType: "feedback",
    entityId: row.id,
    correlation: { feedback_id: row.id, order_id: row.order_id },
  }).catch(() => null);

  await dispatchPendingEvents().catch(() => null);

  return { feedbackId: row.id, eventId, resumed: true };
}
