/**
 * DOC 30 §5 — ownership helpers for user-scoped resources.
 */

import { db, blueprints, orders, feedback, rewardEvents, outcomeValidations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { TorgimaError } from "./errors.js";
import { logAuthSecurityEvent } from "./auth-security-log.js";

async function logCrossUser(
  resourceType: string,
  resourceId: string,
  authUserId: string,
  ownerUserId: string | null | undefined,
): Promise<void> {
  if (ownerUserId && ownerUserId !== authUserId) {
    await logAuthSecurityEvent(
      "CROSS_USER_ACCESS_ATTEMPT",
      { resourceType, resourceId, authUserId, ownerUserId },
      "ERROR",
    );
  }
}

export async function requireBlueprintOwnership(
  blueprintId: string,
  userId: string,
): Promise<{ id: string }> {
  const [bp] = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  if (!bp) {
    throw new TorgimaError("NOT_FOUND", "Blueprint not found");
  }
  if (bp.user_id !== userId) {
    await logCrossUser("blueprint", blueprintId, userId, bp.user_id);
    throw new TorgimaError("NOT_FOUND", "Blueprint not found");
  }
  return { id: bp.id };
}

export async function requireOrderOwnership(
  orderId: string,
  userId: string,
): Promise<{ id: string; blueprint_id: string }> {
  const [order] = await db
    .select({ id: orders.id, user_id: orders.user_id, blueprint_id: orders.blueprint_id })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new TorgimaError("NOT_FOUND", "Order not found");
  }
  if (order.user_id !== userId) {
    await logCrossUser("order", orderId, userId, order.user_id);
    throw new TorgimaError("NOT_FOUND", "Order not found");
  }
  return { id: order.id, blueprint_id: order.blueprint_id };
}

export async function requireFeedbackOwnership(
  feedbackId: string,
  userId: string,
): Promise<{ id: string }> {
  const [row] = await db
    .select({ id: feedback.id, user_id: feedback.user_id })
    .from(feedback)
    .where(eq(feedback.id, feedbackId))
    .limit(1);

  if (!row) {
    throw new TorgimaError("NOT_FOUND", "Feedback not found");
  }
  if (row.user_id !== userId) {
    await logCrossUser("feedback", feedbackId, userId, row.user_id);
    throw new TorgimaError("NOT_FOUND", "Feedback not found");
  }
  return { id: row.id };
}

export async function requireRewardOwnership(rewardId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ id: rewardEvents.id, user_id: rewardEvents.user_id })
    .from(rewardEvents)
    .where(eq(rewardEvents.id, rewardId))
    .limit(1);

  if (!row || row.user_id !== userId) {
    if (row) await logCrossUser("reward", rewardId, userId, row.user_id);
    throw new TorgimaError("NOT_FOUND", "Reward not found");
  }
}

export async function requireOutcomeValidationOwnership(
  outcomeId: string,
  userId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: outcomeValidations.id, user_id: outcomeValidations.user_id })
    .from(outcomeValidations)
    .where(eq(outcomeValidations.id, outcomeId))
    .limit(1);

  if (!row || row.user_id !== userId) {
    if (row) await logCrossUser("outcome_validation", outcomeId, userId, row.user_id);
    throw new TorgimaError("NOT_FOUND", "Outcome validation not found");
  }
}
