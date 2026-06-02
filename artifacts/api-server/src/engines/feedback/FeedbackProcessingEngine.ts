/**
 * CONTINUOUS LOOP AUDIT (2026-05-27)
 * Chain (event-only): feedback_submitted → FeedbackWorker → signal_recalculation_requested
 * → SignalWorker → signal_calculated → ConditionWorker → condition_evaluated
 * → ControlWorker → enforcement_package_created → TaskGenerationWorker
 * → task_generation_completed → TaskGuaranteeWorker → dashboard_refresh_requested → ProjectionWorker.
 * Fixed: removed direct signal_recalculation_requested + task_generation_requested emits here
 * (duplicated FeedbackWorker and skipped condition/control). Entry: POST /api/orders/:id/feedback.
 */
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
import { BhudhiMemoryService } from "../../bhudhi/BhudhiMemoryService.js";
import { runPsychologyPostFeedback } from "../psychology/PsychologyPipeline.js";
import { classifyFailureWithRecord } from "../failure/FailureClassificationRecord.js";
import { capabilityEngine } from "../capability/CapabilityEngine.js";
import { behaviorPatternEngine } from "../behavior/BehaviorPatternEngine.js";
import { runBhudhiFeedbackCycle } from "../../bhudhi/integration/TorgimaIntegration.js";
import type { TaskFeedbackBhudhiResult } from "../../bhudhi/integration/TorgimaIntegration.js";
import { calculateConfidenceWeight } from "./confidenceWeight.js";

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
  difficultyFelt?: string;
}

export interface FeedbackResult {
  feedbackId: string;
  verdictStatus: "accepted" | "needs_interrogation" | "rejected";
  weightedScore: number;
  confidence: string;
  requiresInterrogation: boolean;
  interrogationQuestion?: string;
  eventId: string;
  bhudhi?: TaskFeedbackBhudhiResult | null;
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
  const proof = (input.proofJson ?? {}) as Record<string, unknown>;
  const proofScore = scoreProofForOrder(order, proof);

  const weightResult = calculateConfidenceWeight({
    score: input.score,
    reflection: ref,
    completion: input.completionStatus,
    proof_json: proof,
    started_at: order.started_at,
    proofRequired: Boolean(order.proof_required),
    proofNormalized: order.proof_required ? proofScore.normalized : undefined,
  });

  const { weight, confidence } = weightResult;
  let { flagged } = weightResult;
  let gamingReason = weightResult.flag_reason;

  const hoursAfter = order.started_at
    ? (Date.now() - order.started_at.getTime()) / 3600000
    : 0;
  const latePenalty = hoursAfter > 12;
  const weightedScore = input.score * weight;

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
        confidence_weight: weight,
        weighted_score: weightedScore,
        reflection: ref,
        friction_score: input.frictionScore ?? null,
        confidence_score: input.confidenceScore ?? null,
        duration_minutes: input.durationMinutes ?? null,
        proof_json: input.proofJson ?? {},
        blocker_json: input.blockerJson ?? {},
        difficulty_felt: input.difficultyFelt ?? null,
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
        completed_at: newOrderStatus === "completed" ? new Date() : null,
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

  if (input.completionStatus === "completed" && !requiresInterrogation) {
    const { BlueprintPositionEngine } = await import(
      "../blueprint/BlueprintPositionEngine.js"
    );
    await BlueprintPositionEngine.advanceOnOrderCompleted(
      input.blueprintId,
      input.userId,
      input.orderId,
    ).catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), orderId: input.orderId },
        "[FeedbackEngine] Position advance failed — non-blocking",
      );
    });
  }

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

    if (!requiresInterrogation && ["completed", "partial"].includes(input.completionStatus)) {
      const hadBlocker =
        Boolean(input.blockerJson) && Object.keys(input.blockerJson ?? {}).length > 0;
      await BhudhiMemoryService.buildMemoryCandidateFromFeedback({
        userId: input.userId,
        blueprintId: input.blueprintId,
        feedbackId: feedbackIdOut,
        completionStatus: input.completionStatus,
        score: input.score,
        reflection: ref,
        hadBlocker,
        confidenceLabel: confidence,
      }).catch(() => null);
    }

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
      orderStatus: newOrderStatus,
    },
    "[Feedback] Feedback processed",
  );

  const bhudhi = await runBhudhiFeedbackCycle(input.blueprintId, input.orderId, {
    completionStatus: input.completionStatus,
    score: input.score,
    feedbackText: input.reflection,
  });

  return {
    feedbackId: feedbackIdOut,
    verdictStatus: requiresInterrogation ? "needs_interrogation" : "accepted",
    weightedScore,
    confidence,
    requiresInterrogation,
    interrogationQuestion,
    eventId,
    bhudhi,
  };
}

export class FeedbackProcessingEngine {
  process(input: FeedbackInput): Promise<FeedbackResult> {
    return processFeedback(input);
  }
}
