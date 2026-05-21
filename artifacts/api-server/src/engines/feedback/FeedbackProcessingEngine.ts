import {
  db,
  feedback,
  orders,
  events,
  blueprints,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { OrderStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { writeEventInTx, EVENT_TYPES } from "../../services/EventService.js";
import { recordOperatingLoopStage } from "../../services/OperatingLoopRecorder.js";
import { scoreProofForOrder } from "./ProofScoringEngine.js";
import { runFeedbackCriticCheck } from "../../bhudhi/AdvancedIntelligenceBridge.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { MemoryWriter } from "../../bhudhi/MemoryWriter.js";
import { runPsychologyPostFeedback } from "../psychology/PsychologyPipeline.js";
import { classifyFailureWithRecord } from "../failure/FailureClassificationRecord.js";
import { capabilityEngine } from "../capability/CapabilityEngine.js";
import { behaviorPatternEngine } from "../behavior/BehaviorPatternEngine.js";

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

  const feedbackEligibleStatuses = [
    OrderStatus.PENDING,
    OrderStatus.ACTIVE,
    OrderStatus.NEEDS_FEEDBACK,
    OrderStatus.BLOCKED,
  ] as const;
  if (!feedbackEligibleStatuses.includes(order.status as (typeof feedbackEligibleStatuses)[number])) {
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
    const [bp] = await db
      .select({ state_version: blueprints.state_version })
      .from(blueprints)
      .where(eq(blueprints.id, input.blueprintId))
      .limit(1);

    let clarificationQuestion =
      "This task requires proof of completion. What evidence can you provide?";
    try {
      const clarification = await routeBhudhiRequest({
        sourceEngine: "FEEDBACK_PROCESSING",
        triggerType: "CLARIFICATION_PROMPT",
        userId: input.userId,
        blueprintId: input.blueprintId,
        stateVersion: bp?.state_version ?? 0,
        idempotencyKey: `clarification:${input.orderId}:${input.idempotencyKey}`,
        facts: {
          missingContext: "proof of completion",
          requiredField: "proof",
          taskTitle: order.title ?? "active task",
        },
      });
      const q = (clarification.output?.data as { question?: string } | undefined)?.question;
      if (q?.trim()) clarificationQuestion = q.trim();
    } catch {
      /* default question */
    }

    return {
      feedbackId: "",
      verdictStatus: "needs_interrogation",
      weightedScore: 0,
      confidence: "low",
      requiresInterrogation: true,
      interrogationQuestion: clarificationQuestion,
      eventId: "",
    };
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

  const proof = (input.proofJson ?? {}) as Record<string, unknown>;
  const proofScore = scoreProofForOrder(order, proof);
  if (order.proof_required) {
    weight *= Math.max(0.35, 0.45 + 0.55 * proofScore.normalized);
  }

  weight = Math.max(0.3, weight);
  const weightedScoreBase = input.score * weight;

  const hoursAfter = order.started_at
    ? (Date.now() - order.started_at.getTime()) / 3600000
    : 0;
  const latePenalty = hoursAfter > 12;
  const weightedScore = latePenalty ? weightedScoreBase * 0.9 : weightedScoreBase;

  const confidence = weight >= 0.9 ? "high" : weight >= 0.7 ? "medium" : "low";

  let requiresInterrogation = confidence === "low" && input.completionStatus === "completed";
  let interrogationQuestion: string | undefined = requiresInterrogation
    ? input.score >= 8
      ? "Your reflection was brief. What specifically did you produce that justifies this score?"
      : "Your reflection was brief. What was the actual output of this task?"
    : undefined;

  if (input.score >= 8 && ref.length < 60) {
    const [bp] = await db
      .select({ state_version: blueprints.state_version })
      .from(blueprints)
      .where(eq(blueprints.id, input.blueprintId))
      .limit(1);

    await routeBhudhiRequest({
      sourceEngine: "FEEDBACK_PROCESSING",
      triggerType: "FEEDBACK_CLASSIFICATION",
      userId: input.userId,
      blueprintId: input.blueprintId,
      stateVersion: bp?.state_version ?? input.expectedStateVersion ?? 0,
      idempotencyKey: `feedback_classify:${input.orderId}:${input.idempotencyKey}`,
      facts: {
        feedbackText: ref,
        score: input.score,
        taskTitle: order.title ?? "active task",
      },
    }).catch(() => null);

    const critic = await runFeedbackCriticCheck({
      userId: input.userId,
      blueprintId: input.blueprintId,
      feedbackId: `${input.orderId}:${input.idempotencyKey}`,
      score: input.score,
      reflection: ref,
      stateVersion: bp?.state_version ?? input.expectedStateVersion ?? 0,
    });

    if (critic.requiresInterrogation) {
      requiresInterrogation = true;
      interrogationQuestion = critic.interrogationQuestion ?? interrogationQuestion;
      if (critic.gamingSignal) {
        flagged = true;
        gamingReason = gamingReason ?? "High score with weak reflection (critic)";
      }
    }
  }

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
        late_penalty_applied: latePenalty,
        validity: flagged ? "flagged" : "valid",
        interrogation_json: requiresInterrogation
          ? {
              requires_interrogation: true,
              question: interrogationQuestion ?? null,
            }
          : null,
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
          proof_score_normalized: proofScore.normalized,
          proof_score_formula: proofScore.formula,
        },
      },
      tx,
    );
  });

  await recordOperatingLoopStage({
    blueprintId: input.blueprintId,
    userId: input.userId,
    stage: "REALITY_EXECUTION_RECORDED",
    description: `Feedback recorded for order ${input.orderId}; proof quality ${proofScore.normalized.toFixed(2)}.`,
    causationEventId: eventId,
    triggerEventType: EVENT_TYPES.FEEDBACK_SUBMITTED,
    entityType: "feedback",
    entityId: feedbackIdOut,
    correlation: {
      order_id: input.orderId,
      feedback_id: feedbackIdOut,
      proof_formula: proofScore.formula,
      proof_rationale: proofScore.rationale,
    },
  }).catch(() => null);

  const [feedbackRow] = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, feedbackIdOut))
    .limit(1);

  if (feedbackRow) {
    await capabilityEngine.updateAfterFeedback(input.userId, feedbackRow).catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), userId: input.userId },
        "[FeedbackEngine] Capability update failed",
      );
    });

    const [{ count: feedbackCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.user_id, input.userId));

    if (feedbackCount > 0 && feedbackCount % 3 === 0) {
      await behaviorPatternEngine
        .detectPatterns(input.userId, input.blueprintId)
        .catch((err) => {
          logger.warn(
            { err: err instanceof Error ? err.message : String(err) },
            "[FeedbackEngine] Behavior pattern detection failed",
          );
        });
    }
  }

  if (input.completionStatus === "failed") {
    await MemoryWriter.write({
      userId: input.userId,
      blueprintId: input.blueprintId,
      memoryType: "FRICTION_PATTERN",
      scope: "BLUEPRINT",
      content: `Failed execution: ${ref.slice(0, 200)}`,
      sourceType: "FEEDBACK",
      sourceId: feedbackIdOut,
      confidence: "MEDIUM",
      relevanceScore: 0.65,
      expiresInDays: 30,
    }).catch(() => null);

    await classifyFailureWithRecord({
      userId: input.userId,
      blueprintId: input.blueprintId,
      orderId: input.orderId,
      feedbackId: feedbackIdOut,
      reflection: ref,
    }).catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), feedbackId: feedbackIdOut },
        "[FeedbackEngine] Failure classification failed",
      );
    });
  }

  if (
    input.completionStatus === "completed" &&
    input.score >= 8 &&
    ref.length < 60 &&
    requiresInterrogation
  ) {
    const { bhudhiLogs } = await import("@workspace/db");
    const { mapBhudhiTriggerToDbEnum } = await import("../../bhudhi/bhudhiLogMapping.js");
    const dbTrigger = mapBhudhiTriggerToDbEnum("FEEDBACK_CLASSIFICATION");
    const [existingLog] = await db
      .select({ id: bhudhiLogs.id })
      .from(bhudhiLogs)
      .where(
        and(
          eq(bhudhiLogs.user_id, input.userId),
          eq(bhudhiLogs.trigger_type, dbTrigger),
        ),
      )
      .orderBy(desc(bhudhiLogs.created_at))
      .limit(1);
    if (!existingLog) {
      await routeBhudhiRequest({
        sourceEngine: "FEEDBACK_PROCESSING",
        triggerType: "FEEDBACK_CLASSIFICATION",
        userId: input.userId,
        blueprintId: input.blueprintId,
        stateVersion: input.expectedStateVersion ?? 0,
        idempotencyKey: `feedback_classify_ensure:${feedbackIdOut}`,
        facts: { feedbackText: ref, score: input.score, ensureLog: true },
      }).catch(() => null);
    }
  }

  if (
    input.completionStatus === "failed" ||
    input.completionStatus === "completed" ||
    input.completionStatus === "partial"
  ) {
    await runPsychologyPostFeedback({
      userId: input.userId,
      blueprintId: input.blueprintId,
      orderId: input.orderId,
      feedbackId: feedbackIdOut,
      completionStatus: input.completionStatus,
    }).catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), feedbackId: feedbackIdOut },
        "[FeedbackEngine] Post-feedback psychology failed",
      );
    });
  }

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

export class FeedbackProcessingEngine {
  process(input: FeedbackInput): Promise<FeedbackResult> {
    return processFeedback(input);
  }
}
