/**
 * Phase 1 — execution-loop truth intake (DOC 10).
 * Deterministic proof validation and verdict classification; Bhudhi does not decide proof validity.
 */

import {
  db,
  feedback,
  orders,
  blueprints,
  enforcementPackages,
  idempotencyRecords,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { OrderStatus, BlueprintStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { writeEvent, writeEventInTx, EVENT_TYPES } from "../../services/EventService.js";
import type { EventType } from "../../types/eventContracts.js";
import { resolveInactivityOnFeedback } from "../inactivity/InactivityResolution.js";
import { evidenceLedgerService } from "../../services/erector/evidence/EvidenceLedgerService.js";
import { validateProof } from "../execution-loop/feedback/ProofValidator.js";
import { detectGaming } from "../execution-loop/feedback/GamingDetector.js";
import {
  buildInterrogationDecision,
} from "../execution-loop/feedback/InterrogationEngine.js";
import { classifyBlocker } from "../execution-loop/feedback/BlockerClassifier.js";
import {
  confidenceLabel,
  determineFeedbackVerdict,
} from "../execution-loop/feedback/FeedbackVerdictEngine.js";
import { applyLateFeedbackPenalty } from "../execution-loop/feedback/lateFeedback.js";

export interface FeedbackSubmissionPayload {
  orderId: string;
  completion: "COMPLETED" | "PARTIAL" | "FAILED" | "BLOCKED" | "SKIPPED";
  proofType?: "NONE" | "TEXT" | "FILE" | "LINK" | "CHECKLIST" | "OUTPUT";
  proofText?: string;
  proofFileIds?: string[];
  proofLinks?: string[];
  checklistAnswers?: Array<{ itemId: string; completed: boolean }>;
  durationMinutes?: number;
  effortScore?: 1 | 2 | 3 | 4 | 5;
  frictionScore?: 1 | 2 | 3 | 4 | 5;
  confidenceScore?: 1 | 2 | 3 | 4 | 5;
  blockerReason?: string;
  userNotes?: string;
  clientStateVersion: number;
  idempotencyKey: string;
}

export type FeedbackVerdict =
  | "ACCEPTED"
  | "PARTIAL_ACCEPTED"
  | "CLARIFICATION_REQUIRED"
  | "REJECTED"
  | "BLOCKED_CONFIRMED"
  | "FAILED_CONFIRMED"
  | "HELD_FOR_REVIEW";

export interface FeedbackProcessResult {
  verdict: FeedbackVerdict;
  orderId: string;
  feedbackId?: string;
  eventId?: string;
  nextOrderId?: string;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const IDEMPOTENCY_PREFIX = "feedback_submit:";

function idempotencyStorageKey(key: string): string {
  return `${IDEMPOTENCY_PREFIX}${key}`;
}

function hasProof(payload: FeedbackSubmissionPayload): boolean {
  if (payload.proofText?.trim()) return true;
  if (payload.proofFileIds && payload.proofFileIds.length > 0) return true;
  if (payload.proofLinks && payload.proofLinks.length > 0) return true;
  if (payload.checklistAnswers && payload.checklistAnswers.some((c) => c.completed)) return true;
  return false;
}

function buildProofJson(payload: FeedbackSubmissionPayload): Record<string, unknown> {
  return {
    proof_type: payload.proofType ?? "NONE",
    proof_text: payload.proofText ?? null,
    proof_file_ids: payload.proofFileIds ?? [],
    proof_links: payload.proofLinks ?? [],
    checklist_answers: payload.checklistAnswers ?? [],
    idempotency_key: payload.idempotencyKey,
  };
}

function completionToFeedbackStatus(
  completion: FeedbackSubmissionPayload["completion"],
): string {
  switch (completion) {
    case "COMPLETED":
      return "completed";
    case "PARTIAL":
      return "partial";
    case "FAILED":
      return "failed";
    case "BLOCKED":
      return "blocked";
    case "SKIPPED":
      return "skipped";
    default:
      return "completed";
  }
}

function verdictToOrderStatus(verdict: FeedbackVerdict): string {
  switch (verdict) {
    case "ACCEPTED":
      return OrderStatus.COMPLETED;
    case "PARTIAL_ACCEPTED":
      return OrderStatus.NEEDS_FEEDBACK;
    case "CLARIFICATION_REQUIRED":
      return OrderStatus.NEEDS_PROOF;
    case "REJECTED":
      return OrderStatus.PENDING;
    case "BLOCKED_CONFIRMED":
      return OrderStatus.BLOCKED;
    case "FAILED_CONFIRMED":
      return OrderStatus.FAILED;
    case "HELD_FOR_REVIEW":
      return OrderStatus.NEEDS_FEEDBACK;
    default:
      return OrderStatus.PENDING;
  }
}

function scoreFromPayload(payload: FeedbackSubmissionPayload): number {
  if (payload.effortScore != null) return Math.min(10, Math.max(0, payload.effortScore * 2));
  return 5;
}

export function runAntiGamingChecks(params: {
  payload: FeedbackSubmissionPayload;
  order: typeof orders.$inferSelect;
  recentFeedbacks: (typeof feedback.$inferSelect)[];
}): { verdict: FeedbackVerdict | null; reason?: string } {
  const reflection = (params.payload.userNotes ?? params.payload.blockerReason ?? "").trim() || "—";
  const gaming = detectGaming({
    payload: params.payload,
    order: params.order,
    recentFeedbacks: params.recentFeedbacks,
    reflection,
  });

  if (gaming.legacy_reason === "score_inflation") {
    return { verdict: "REJECTED", reason: gaming.legacy_reason };
  }
  if (gaming.legacy_reason === "instant_completion" || gaming.flags.includes("INSTANT_COMPLETION")) {
    return { verdict: "HELD_FOR_REVIEW", reason: gaming.legacy_reason ?? "instant_completion" };
  }
  if (params.order.proof_required && !hasProof(params.payload)) {
    return { verdict: "CLARIFICATION_REQUIRED", reason: "proof_required_missing" };
  }
  if (gaming.legacy_reason === "skipped_hard_proof_task") {
    return { verdict: "HELD_FOR_REVIEW", reason: gaming.legacy_reason };
  }
  if (gaming.flags.includes("REPEATED_PERFECT_SCORE_PATTERN")) {
    return { verdict: "HELD_FOR_REVIEW", reason: "repeated_perfection" };
  }
  return { verdict: null };
}

export function classifyVerdict(params: {
  payload: FeedbackSubmissionPayload;
  order: typeof orders.$inferSelect;
  antiGaming: FeedbackVerdict | null;
  proofPresent: boolean;
}): FeedbackVerdict {
  if (params.antiGaming) return params.antiGaming;

  const reflection = (params.payload.userNotes ?? params.payload.blockerReason ?? "").trim() || "—";
  const gaming = detectGaming({
    payload: params.payload,
    order: params.order,
    recentFeedbacks: [],
    reflection,
  });
  const proofValidation = validateProof({
    payload: params.payload,
    order: params.order,
  });
  const late = applyLateFeedbackPenalty(gaming.confidence_multiplier, params.order.started_at);
  const interrogation = buildInterrogationDecision({
    confidence_multiplier: late.confidence_multiplier,
    flags: gaming.flags,
    trigger_interrogation: gaming.trigger_interrogation,
    taskTitle: params.order.title,
  });
  const blocker =
    params.payload.completion === "BLOCKED"
      ? classifyBlocker(params.payload.blockerReason ?? reflection)
      : undefined;

  return determineFeedbackVerdict({
    payload: params.payload,
    order: params.order,
    proofPresent: params.proofPresent,
    proofValidation,
    gaming,
    confidence_multiplier: late.confidence_multiplier,
    interrogation,
    blocker,
  });
}

function primaryEventForVerdict(verdict: FeedbackVerdict): EventType {
  switch (verdict) {
    case "ACCEPTED":
      return EVENT_TYPES.FEEDBACK_SUBMITTED;
    case "PARTIAL_ACCEPTED":
      return EVENT_TYPES.FEEDBACK_SUBMITTED_PARTIAL;
    case "CLARIFICATION_REQUIRED":
      return EVENT_TYPES.FEEDBACK_NEEDS_CLARIFICATION;
    case "REJECTED":
      return EVENT_TYPES.FEEDBACK_REJECTED;
    case "BLOCKED_CONFIRMED":
      return EVENT_TYPES.FEEDBACK_BLOCKED;
    case "FAILED_CONFIRMED":
      return EVENT_TYPES.FEEDBACK_FAILED;
    case "HELD_FOR_REVIEW":
      return EVENT_TYPES.FEEDBACK_HELD_FOR_REVIEW;
    default:
      return EVENT_TYPES.FEEDBACK_REJECTED;
  }
}

async function emitSecondaryEvents(params: {
  verdict: FeedbackVerdict;
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  causationEventId: string;
}): Promise<void> {
  const { verdict, userId, blueprintId, orderId, feedbackId, causationEventId } = params;
  const base = {
    userId,
    blueprintId,
    entityType: "feedback" as const,
    entityId: feedbackId,
    causationEventId,
  };

  if (verdict === "CLARIFICATION_REQUIRED") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.CLARIFICATION_TASK_REQUESTED,
      payload: { order_id: orderId, feedback_id: feedbackId },
      idempotencyKey: `clarification_task:${feedbackId}`,
    });
  }

  if (verdict === "BLOCKED_CONFIRMED") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.DEPENDENCY_CHECK_REQUESTED,
      payload: { order_id: orderId, feedback_id: feedbackId },
      idempotencyKey: `dependency_check:${feedbackId}`,
    });
  }

  if (verdict === "FAILED_CONFIRMED") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.FAILURE_CLASSIFICATION_REQUESTED,
      payload: { order_id: orderId, feedback_id: feedbackId },
      idempotencyKey: `failure_classification:${feedbackId}`,
    });
  }
}

async function emitBlockerResolutionEvent(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  causationEventId: string;
  blockerCategory: string;
  resolutionEvent: EventType;
}): Promise<void> {
  await writeEvent({
    userId: params.userId,
    blueprintId: params.blueprintId,
    entityType: "feedback",
    entityId: params.feedbackId,
    causationEventId: params.causationEventId,
    eventType: params.resolutionEvent,
    payload: {
      order_id: params.orderId,
      feedback_id: params.feedbackId,
      blocker_category: params.blockerCategory,
    },
    idempotencyKey: `blocker_resolution:${params.feedbackId}:${params.blockerCategory}`,
  });
}

export async function processFeedbackSubmission(
  userId: string,
  payload: FeedbackSubmissionPayload,
): Promise<FeedbackProcessResult> {
  const storageKey = idempotencyStorageKey(payload.idempotencyKey);

  const [cached] = await db
    .select({ result: idempotencyRecords.result })
    .from(idempotencyRecords)
    .where(eq(idempotencyRecords.key, storageKey))
    .limit(1);

  if (cached?.result && typeof cached.result === "object") {
    const prior = cached.result as FeedbackProcessResult;
    return prior;
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, payload.orderId), eq(orders.user_id, userId)))
    .limit(1);

  if (!order) {
    throw new TorgimaError("NOT_FOUND", "Order not found", false);
  }

  const eligible = [
    OrderStatus.PENDING,
    OrderStatus.ACTIVE,
    OrderStatus.NEEDS_FEEDBACK,
    OrderStatus.BLOCKED,
    OrderStatus.NEEDS_PROOF,
  ];
  if (!eligible.includes(order.status as (typeof eligible)[number])) {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      `Cannot submit feedback for order in status: ${order.status}`,
      false,
    );
  }

  const [blueprint] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.id, order.blueprint_id), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!blueprint || blueprint.status !== BlueprintStatus.ACTIVE || !blueprint.active) {
    throw new TorgimaError("VALIDATION_ERROR", "Blueprint is not active", false);
  }

  if (payload.clientStateVersion !== blueprint.state_version) {
    await writeEvent({
      eventType: EVENT_TYPES.STATE_CONFLICT_DETECTED,
      entityType: "blueprint",
      entityId: blueprint.id,
      userId,
      blueprintId: blueprint.id,
      payload: {
        expected_version: payload.clientStateVersion,
        current_version: blueprint.state_version,
        order_id: payload.orderId,
      },
      idempotencyKey: `state_conflict:${payload.orderId}:${payload.idempotencyKey}`,
    }).catch(() => null);

    throw new TorgimaError(
      "STALE_STATE",
      `State version mismatch. Expected ${payload.clientStateVersion}, current ${blueprint.state_version}.`,
      true,
    );
  }

  const [pkg] = await db
    .select({ id: enforcementPackages.id })
    .from(enforcementPackages)
    .where(
      and(
        eq(enforcementPackages.blueprint_id, blueprint.id),
        eq(enforcementPackages.is_current, true),
      ),
    )
    .limit(1);

  if (!pkg) {
    throw new TorgimaError(
      "ENFORCEMENT_PACKAGE_MISSING",
      "No current enforcement package for blueprint",
      false,
    );
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentFeedbacks = await db
    .select()
    .from(feedback)
    .where(
      and(eq(feedback.user_id, userId), eq(feedback.blueprint_id, blueprint.id), gte(feedback.created_at, sevenDaysAgo)),
    )
    .orderBy(desc(feedback.created_at))
    .limit(6);

  const proofPresent = hasProof(payload);
  const reflection = (payload.userNotes ?? payload.blockerReason ?? "").trim() || "—";
  const proofValidation = validateProof({ payload, order });
  const gaming = detectGaming({
    payload,
    order,
    recentFeedbacks,
    reflection,
    proofUnrelated:
      proofPresent && !proofValidation.valid && proofValidation.rejection_reason?.includes("output"),
  });
  const late = applyLateFeedbackPenalty(gaming.confidence_multiplier, order.started_at);
  const interrogation = buildInterrogationDecision({
    confidence_multiplier: late.confidence_multiplier,
    flags: [...gaming.flags, ...late.flags],
    trigger_interrogation: gaming.trigger_interrogation,
    taskTitle: order.title,
  });
  const blocker =
    payload.completion === "BLOCKED" ? classifyBlocker(payload.blockerReason ?? reflection) : undefined;
  const verdict = determineFeedbackVerdict({
    payload,
    order,
    proofPresent,
    proofValidation,
    gaming,
    confidence_multiplier: late.confidence_multiplier,
    interrogation,
    blocker,
  });

  const score = scoreFromPayload(payload);
  const weightedScore = score * late.confidence_multiplier;
  const completionStatus = completionToFeedbackStatus(payload.completion);
  const orderStatus = verdictToOrderStatus(verdict);
  const gamingFlag =
    verdict === "REJECTED" || verdict === "HELD_FOR_REVIEW" || gaming.gaming_suspected;
  const primaryEventType = primaryEventForVerdict(verdict);
  const confidence = confidenceLabel(late.confidence_multiplier);

  let feedbackId = "";
  let eventId = "";

  await db.transaction(async (tx: Tx) => {
    const [row] = await tx
      .insert(feedback)
      .values({
        order_id: payload.orderId,
        blueprint_id: blueprint.id,
        user_id: userId,
        completion_status: completionStatus,
        score,
        weighted_score: weightedScore,
        confidence_weight: late.confidence_multiplier,
        reflection,
        friction_score: payload.frictionScore ?? null,
        confidence_score: payload.confidenceScore ?? null,
        duration_minutes: payload.durationMinutes ?? null,
        proof_json: buildProofJson(payload),
        blocker_json:
          payload.completion === "BLOCKED"
            ? {
                reason: payload.blockerReason ?? "",
                had_blocker: true,
                blocker_category: blocker?.blocker_category ?? null,
                recommended_resolution: blocker?.recommended_resolution ?? null,
              }
            : {},
        interrogation_json:
          verdict === "CLARIFICATION_REQUIRED" && interrogation.question
            ? {
                question: interrogation.question,
                validation_status: "needs_interrogation",
                flags: gaming.flags,
                confidence,
              }
            : {},
        gaming_flag: gamingFlag,
        gaming_reason: gaming.legacy_reason ?? (gaming.flags.length ? gaming.flags.join(",") : null),
        late_penalty_applied: late.late_penalty_applied,
        submitted_hours_after_completion: late.submitted_hours_after_start,
        validity: verdict === "REJECTED" ? "flagged" : "valid",
      })
      .returning({ id: feedback.id });

    if (!row) throw new Error("Failed to insert feedback");
    feedbackId = row.id;

    await tx
      .update(orders)
      .set({
        status: orderStatus as typeof orders.$inferInsert["status"],
        finished_at: ["completed", "failed", "skipped"].includes(orderStatus)
          ? new Date()
          : order.finished_at,
        completed_at: orderStatus === OrderStatus.COMPLETED ? new Date() : order.completed_at,
        output_summary: reflection.slice(0, 500),
      })
      .where(eq(orders.id, payload.orderId));

    eventId = await writeEventInTx(
      {
        eventType: primaryEventType,
        entityType: "feedback",
        entityId: feedbackId,
        userId,
        blueprintId: blueprint.id,
        payload: {
          feedback_id: feedbackId,
          order_id: payload.orderId,
          verdict,
          completion_status: completionStatus,
          idempotency_key: payload.idempotencyKey,
          requires_signal: verdict === "ACCEPTED" || verdict === "PARTIAL_ACCEPTED",
        },
        idempotencyKey: `${primaryEventType}:${feedbackId}`,
      },
      tx,
    );
  });

  const result: FeedbackProcessResult = {
    verdict,
    orderId: payload.orderId,
    feedbackId,
    eventId,
  };

  const proofJson = buildProofJson(payload);
  if (proofPresent && Object.keys(proofJson).length > 0) {
    try {
      await evidenceLedgerService.submit({
        userId,
        blueprintId: blueprint.id,
        taskId: payload.orderId,
        sourceType: "user_upload",
        contentJson: proofJson,
        contentSummary: reflection.substring(0, 200),
      });
    } catch (err) {
      logger.warn(
        { err, orderId: payload.orderId, feedbackId },
        "[FeedbackProcessingEngine] Evidence ledger submit failed",
      );
    }
  }

  await db
    .insert(idempotencyRecords)
    .values({
      key: storageKey,
      event_id: eventId,
      result: result as unknown as Record<string, unknown>,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .onConflictDoNothing()
    .catch(() => null);

  await emitSecondaryEvents({
    verdict,
    userId,
    blueprintId: blueprint.id,
    orderId: payload.orderId,
    feedbackId,
    causationEventId: eventId,
  });

  if (verdict === "BLOCKED_CONFIRMED" && blocker) {
    await emitBlockerResolutionEvent({
      userId,
      blueprintId: blueprint.id,
      orderId: payload.orderId,
      feedbackId,
      causationEventId: eventId,
      blockerCategory: blocker.blocker_category,
      resolutionEvent: blocker.resolution_event,
    });
  }

  if (verdict === "ACCEPTED" || verdict === "PARTIAL_ACCEPTED") {
    await resolveInactivityOnFeedback(userId, blueprint.id).catch(() => null);
  }

  logger.info(
    { orderId: payload.orderId, verdict, feedbackId, eventId },
    "[FeedbackProcessingEngine] Processed",
  );

  return result;
}

export async function processFeedbackClarification(
  userId: string,
  feedbackId: string,
  clarificationText: string,
): Promise<FeedbackProcessResult> {
  if (clarificationText.trim().length < 30) {
    throw new TorgimaError("VALIDATION_ERROR", "Clarification must be at least 30 characters", false);
  }

  const [row] = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.id, feedbackId), eq(feedback.user_id, userId)))
    .limit(1);

  if (!row) {
    throw new TorgimaError("NOT_FOUND", "Feedback not found", false);
  }

  const interrogation = (row.interrogation_json ?? {}) as Record<string, unknown>;
  if (interrogation["clarification_submitted"]) {
    return {
      verdict: "ACCEPTED",
      orderId: row.order_id,
      feedbackId: row.id,
    };
  }

  if (interrogation["validation_status"] !== "needs_interrogation") {
    throw new TorgimaError("VALIDATION_ERROR", "Feedback is not awaiting clarification", false);
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, row.order_id), eq(orders.user_id, userId)))
    .limit(1);

  if (!order) {
    throw new TorgimaError("NOT_FOUND", "Order not found", false);
  }

  const mergedReflection = `${row.reflection ?? ""}\n---CLARIFICATION---\n${clarificationText.trim()}`;
  const proofJson = (row.proof_json ?? {}) as Record<string, unknown>;
  const payload: FeedbackSubmissionPayload = {
    orderId: row.order_id,
    completion: row.completion_status === "partial"
      ? "PARTIAL"
      : row.completion_status === "failed"
        ? "FAILED"
        : row.completion_status === "blocked"
          ? "BLOCKED"
          : "COMPLETED",
    proofType: (proofJson.proof_type as FeedbackSubmissionPayload["proofType"]) ?? "NONE",
    proofText: typeof proofJson.proof_text === "string" ? proofJson.proof_text : undefined,
    userNotes: mergedReflection,
    clientStateVersion: 0,
    idempotencyKey: `clarify:${feedbackId}`,
  };

  const gaming = detectGaming({
    payload,
    order,
    recentFeedbacks: [],
    reflection: mergedReflection,
  });
  const late = applyLateFeedbackPenalty(
    Math.max(0.4, gaming.confidence_multiplier),
    order.started_at,
  );
  const proofValidation = validateProof({ payload, order });
  const interrogationDecision = buildInterrogationDecision({
    confidence_multiplier: late.confidence_multiplier,
    flags: gaming.flags,
    trigger_interrogation: false,
    taskTitle: order.title,
  });

  let verdict = determineFeedbackVerdict({
    payload,
    order,
    proofPresent: hasProof(payload),
    proofValidation,
    gaming,
    confidence_multiplier: late.confidence_multiplier,
    interrogation: interrogationDecision,
    hasPriorClarification: true,
  });

  if (verdict === "CLARIFICATION_REQUIRED" || verdict === "REJECTED") {
    verdict = "ACCEPTED";
    late.confidence_multiplier = Math.max(0.4, late.confidence_multiplier);
  }

  const score = row.score ?? scoreFromPayload(payload);
  const weightedScore = score * late.confidence_multiplier;
  const orderStatus = verdictToOrderStatus(verdict);
  const primaryEventType = primaryEventForVerdict(verdict);

  let eventId = "";

  await db.transaction(async (tx: Tx) => {
    await tx
      .update(feedback)
      .set({
        reflection: mergedReflection,
        weighted_score: weightedScore,
        confidence_weight: late.confidence_multiplier,
        interrogation_json: {
          ...interrogation,
          clarification_text: clarificationText.trim(),
          clarification_submitted: true,
          validation_status: "accepted",
          answered_at: new Date().toISOString(),
        },
        validity: "valid",
        gaming_flag: false,
      })
      .where(eq(feedback.id, row.id));

    await tx
      .update(orders)
      .set({
        status: orderStatus as typeof orders.$inferInsert["status"],
        completed_at: orderStatus === OrderStatus.COMPLETED ? new Date() : order.completed_at,
        finished_at: orderStatus === OrderStatus.COMPLETED ? new Date() : order.finished_at,
      })
      .where(eq(orders.id, row.order_id));

    eventId = await writeEventInTx(
      {
        eventType: primaryEventType,
        entityType: "feedback",
        entityId: row.id,
        userId,
        blueprintId: row.blueprint_id,
        payload: {
          feedback_id: row.id,
          order_id: row.order_id,
          verdict,
          clarification: true,
          requires_signal: verdict === "ACCEPTED" || verdict === "PARTIAL_ACCEPTED",
        },
        idempotencyKey: `${primaryEventType}:clarify:${row.id}`,
      },
      tx,
    );
  });

  if (verdict === "ACCEPTED" || verdict === "PARTIAL_ACCEPTED") {
    await resolveInactivityOnFeedback(userId, row.blueprint_id).catch(() => null);
  }

  return {
    verdict,
    orderId: row.order_id,
    feedbackId: row.id,
    eventId,
  };
}

