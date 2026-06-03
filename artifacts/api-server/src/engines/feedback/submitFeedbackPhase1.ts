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
  const { payload, order, recentFeedbacks } = params;
  const notes = (payload.userNotes ?? "").trim();
  const duration = payload.durationMinutes ?? 0;
  const estimate = order.time_estimate_minutes ?? 30;

  if (order.proof_required && !hasProof(payload)) {
    return { verdict: "CLARIFICATION_REQUIRED", reason: "proof_required_missing" };
  }

  if (
    payload.effortScore === 5 &&
    payload.frictionScore === 1 &&
    notes.length < 10 &&
    duration < estimate * 0.2
  ) {
    return { verdict: "REJECTED", reason: "score_inflation" };
  }

  if (duration < 2 && estimate > 15) {
    return { verdict: "HELD_FOR_REVIEW", reason: "instant_completion" };
  }

  const lastFive = recentFeedbacks.slice(0, 5);
  if (lastFive.length >= 5 && payload.effortScore === 5 && payload.confidenceScore === 5) {
    const allPerfect = lastFive.every(
      (f) => (f.score ?? 0) >= 9 && (f.confidence_score ?? 0) >= 5 && !f.gaming_flag,
    );
    if (allPerfect) {
      return { verdict: "HELD_FOR_REVIEW", reason: "repeated_perfection" };
    }
  }

  if (
    payload.completion === "SKIPPED" &&
    order.proof_required &&
    (order.difficulty === "hard" || order.difficulty === "very_hard")
  ) {
    return { verdict: "HELD_FOR_REVIEW", reason: "skipped_hard_proof_task" };
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

  const { payload, proofPresent } = params;

  if (payload.completion === "PARTIAL") return "PARTIAL_ACCEPTED";
  if (payload.completion === "FAILED") return "FAILED_CONFIRMED";
  if (payload.completion === "BLOCKED") {
    if ((payload.blockerReason ?? "").trim().length >= 5) return "BLOCKED_CONFIRMED";
    return "CLARIFICATION_REQUIRED";
  }
  if (payload.completion === "SKIPPED") return "REJECTED";

  if (payload.completion === "COMPLETED") {
    if (params.order.proof_required && !proofPresent) return "CLARIFICATION_REQUIRED";
    return "ACCEPTED";
  }

  return "CLARIFICATION_REQUIRED";
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
  const anti = runAntiGamingChecks({ payload, order, recentFeedbacks });
  const verdict = classifyVerdict({
    payload,
    order,
    antiGaming: anti.verdict,
    proofPresent,
  });

  const reflection = (payload.userNotes ?? payload.blockerReason ?? "").trim() || "—";
  const score = scoreFromPayload(payload);
  const completionStatus = completionToFeedbackStatus(payload.completion);
  const orderStatus = verdictToOrderStatus(verdict);
  const gamingFlag = verdict === "REJECTED" || verdict === "HELD_FOR_REVIEW";
  const primaryEventType = primaryEventForVerdict(verdict);

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
        weighted_score: score,
        confidence_weight: 1,
        reflection,
        friction_score: payload.frictionScore ?? null,
        confidence_score: payload.confidenceScore ?? null,
        duration_minutes: payload.durationMinutes ?? null,
        proof_json: buildProofJson(payload),
        blocker_json:
          payload.completion === "BLOCKED"
            ? { reason: payload.blockerReason ?? "", had_blocker: true }
            : {},
        gaming_flag: gamingFlag,
        gaming_reason: anti.reason ?? null,
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

  if (verdict === "ACCEPTED" || verdict === "PARTIAL_ACCEPTED") {
    await resolveInactivityOnFeedback(userId, blueprint.id).catch(() => null);
  }

  logger.info(
    { orderId: payload.orderId, verdict, feedbackId, eventId },
    "[FeedbackProcessingEngine] Processed",
  );

  return result;
}

