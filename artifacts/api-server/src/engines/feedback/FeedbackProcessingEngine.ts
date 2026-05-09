import {
  db,
  feedback,
  orders,
  events,
  capabilityProfiles,
  capabilityHistory,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { writeEventInTx, EVENT_TYPES } from "../../services/EventService.js";

export interface FeedbackInput {
  orderId: string;
  userId: string;
  blueprintId: string;
  completionStatus: "completed" | "partial" | "failed" | "skipped";
  score: number;
  reflection: string;
  proofJson?: Record<string, unknown>;
  blockerJson?: Record<string, unknown>;
  durationMinutes?: number;
  frictionScore?: number;
  confidenceScore?: number;
  idempotencyKey: string;
  expectedStateVersion?: number;
}

export interface FeedbackResult {
  feedbackId: string;
  verdictStatus: "accepted" | "needs_interrogation" | "rejected";
  weightedScore: number;
  confidence: string;
  requiresInterrogation: boolean;
  interrogationQuestion?: string;
  eventId: string;
}

export async function processFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const [existing] = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.order_id, input.orderId), eq(feedback.user_id, input.userId)))
    .orderBy(desc(feedback.created_at))
    .limit(1);

  if (existing && existing.completion_status === input.completionStatus) {
    const [existingEvent] = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(eq(events.entity_id, existing.id), eq(events.event_type, EVENT_TYPES.FEEDBACK_SUBMITTED)),
      )
      .limit(1);

    return {
      feedbackId: existing.id,
      verdictStatus: "accepted",
      weightedScore: existing.weighted_score ?? 0,
      confidence: "medium",
      requiresInterrogation: false,
      eventId: existingEvent?.id ?? "",
    };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.user_id, input.userId),
        eq(orders.blueprint_id, input.blueprintId),
      ),
    )
    .limit(1);

  if (!order) throw new TorgimaError("NOT_FOUND", "Order not found", false);

  const terminal = ["completed", "failed", "skipped", "cancelled"];
  if (terminal.includes(order.status)) {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      `Cannot submit feedback for order in status: ${order.status}`,
      false,
    );
  }

  if (!["pending", "active", "needs_feedback", "blocked"].includes(order.status)) {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      `Cannot submit feedback for order in status: ${order.status}`,
      false,
    );
  }

  if (input.score < 0 || input.score > 10) {
    throw new TorgimaError("VALIDATION_ERROR", "Score must be 0–10", false);
  }

  if (!input.reflection || input.reflection.trim().length < 10) {
    throw new TorgimaError("VALIDATION_ERROR", "Reflection must be at least 10 characters", false);
  }

  if (order.proof_required && (!input.proofJson || Object.keys(input.proofJson).length === 0)) {
    throw new TorgimaError("VALIDATION_ERROR", "This task requires proof of completion", false);
  }

  const ref = input.reflection.trim();
  let weight = 1.0;
  let flagged = false;
  let gamingReason: string | undefined;

  if (ref.length < 30) weight -= 0.2;
  if (input.score >= 9 && ref.length < 50) {
    weight -= 0.3;
    flagged = true;
    gamingReason = "High score with weak reflection";
  }
  if (input.score === 10 && ref.length < 100) weight -= 0.2;
  if (input.completionStatus === "completed" && input.score <= 2) weight -= 0.2;

  weight = Math.max(0.3, weight);
  const weightedScoreBase = input.score * weight;

  const hoursAfter = order.started_at
    ? (Date.now() - order.started_at.getTime()) / 3600000
    : 0;
  const latePenalty = hoursAfter > 12;
  const weightedScore = latePenalty ? weightedScoreBase * 0.9 : weightedScoreBase;

  const confidence = weight >= 0.9 ? "high" : weight >= 0.7 ? "medium" : "low";

  const requiresInterrogation = confidence === "low" && input.completionStatus === "completed";
  const interrogationQuestion = requiresInterrogation
    ? input.score >= 8
      ? "Your reflection was brief. What specifically did you produce that justifies this score?"
      : "Your reflection was brief. What was the actual output of this task?"
    : undefined;

  const newOrderStatus =
    input.completionStatus === "failed"
      ? "failed"
      : input.completionStatus === "skipped"
        ? "skipped"
        : input.completionStatus === "partial"
          ? "needs_feedback"
          : "completed";

  let feedbackIdOut = "";

  const eventId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(feedback)
      .values({
        order_id: input.orderId,
        blueprint_id: input.blueprintId,
        user_id: input.userId,
        completion_status: input.completionStatus,
        score: input.score,
        weighted_score: weightedScore,
        reflection: ref,
        friction_score: input.frictionScore ?? null,
        confidence_score: input.confidenceScore ?? null,
        duration_minutes: input.durationMinutes ?? null,
        proof_json: input.proofJson ?? {},
        blocker_json: input.blockerJson ?? {},
        gaming_flag: flagged,
        gaming_reason: gamingReason ?? null,
        validity: flagged ? "flagged" : "valid",
      })
      .returning({ id: feedback.id });

    if (!row) throw new Error("Failed to create feedback");
    feedbackIdOut = row.id;

    await tx
      .update(orders)
      .set({
        status: newOrderStatus as typeof orders.$inferInsert["status"],
        finished_at: new Date(),
        output_summary: ref.slice(0, 500),
      })
      .where(eq(orders.id, input.orderId));

    return writeEventInTx(
      {
        eventType: EVENT_TYPES.FEEDBACK_SUBMITTED,
        entityType: "feedback",
        entityId: row.id,
        userId: input.userId,
        blueprintId: input.blueprintId,
        idempotencyKey: `feedback_submitted:${row.id}`,
        payload: {
          feedback_id: row.id,
          order_id: input.orderId,
          weighted_score: weightedScore,
          confidence,
          requires_interrogation: requiresInterrogation,
          completion_status: input.completionStatus,
          idempotency_key_input: input.idempotencyKey,
        },
      },
      tx,
    );
  });

  await updateCapabilityFromFeedback({
    userId: input.userId,
    completionStatus: input.completionStatus,
    score: input.score,
    difficulty: order.difficulty,
  }).catch(() => null);

  logger.info(
    {
      blueprintId: input.blueprintId,
      feedbackId: feedbackIdOut,
      completion: input.completionStatus,
      confidence,
      requiresInterrogation,
    },
    "[FeedbackEngine] Feedback processed",
  );

  return {
    feedbackId: feedbackIdOut,
    verdictStatus: requiresInterrogation ? "needs_interrogation" : "accepted",
    weightedScore,
    confidence,
    requiresInterrogation,
    interrogationQuestion,
    eventId,
  };
}

async function updateCapabilityFromFeedback(params: {
  userId: string;
  completionStatus: string;
  score: number;
  difficulty: string;
}): Promise<void> {
  const [cap] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  if (!cap) return;

  const isCompleted = params.completionStatus === "completed";
  const scoreWeight = params.score / 10;
  const newQuality = Math.min(1.0, cap.execution_quality * 0.9 + scoreWeight * 0.1);
  const nextCompleted = cap.tasks_completed + (isCompleted ? 1 : 0);
  const nextFailed = cap.tasks_failed + (params.completionStatus === "failed" ? 1 : 0);
  const nextStreak = isCompleted ? cap.streak_current + 1 : 0;
  const nextBest =
    isCompleted && nextStreak > cap.streak_best ? nextStreak : cap.streak_best;

  await db
    .update(capabilityProfiles)
    .set({
      tasks_completed: nextCompleted,
      tasks_failed: nextFailed,
      execution_quality: newQuality,
      streak_current: nextStreak,
      streak_best: nextBest,
    })
    .where(eq(capabilityProfiles.user_id, params.userId));

  await db
    .insert(capabilityHistory)
    .values({
      user_id: params.userId,
      trigger_event: "feedback_submitted",
      snapshot: {
        tasks_completed: nextCompleted,
        execution_quality: newQuality,
        streak: nextStreak,
        difficulty: params.difficulty,
      },
    })
    .catch(() => null);
}

export class FeedbackProcessingEngine {
  process(input: FeedbackInput): Promise<FeedbackResult> {
    return processFeedback(input);
  }
}
