/**
 * Phase 3 DOC 19 — five streak dimensions (read-only from feedback history).
 */

import { db, feedback, orders } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { isVerifiedFeedbackEvidence } from "../intelligence/IdentityContinuityEngine.js";

export interface ExecutionStreaks {
  execution_streak: number;
  return_streak: number;
  recovery_streak: number;
  truth_streak: number;
  focus_streak: number;
}

export async function computeStreaks(
  userId: string,
  blueprintId: string,
): Promise<ExecutionStreaks> {
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, userId),
        eq(feedback.blueprint_id, blueprintId),
        gte(feedback.created_at, since),
      ),
    )
    .orderBy(desc(feedback.created_at))
    .limit(40);

  let execution_streak = 0;
  let truth_streak = 0;
  let recovery_streak = 0;

  for (const row of rows) {
    if (isVerifiedFeedbackEvidence(row) && row.completion_status === "completed") {
      execution_streak++;
    } else if (execution_streak > 0) {
      break;
    }
  }

  for (const row of rows) {
    const honest =
      row.completion_status === "failed" ||
      row.completion_status === "blocked" ||
      row.completion_status === "skipped";
    const reflectionLen = (row.reflection ?? "").trim().length;
    if (honest && reflectionLen >= 30 && row.validity === "valid") {
      truth_streak++;
    } else if (truth_streak > 0) {
      break;
    }
  }

  for (const row of rows) {
    if (
      row.completion_status === "completed" &&
      (row.blocker_json as { had_blocker?: boolean } | null)?.had_blocker
    ) {
      recovery_streak++;
    } else if (recovery_streak > 0) {
      break;
    }
  }

  const [topOrder] = await db
    .select({ id: orders.id, priority: orders.priority })
    .from(orders)
    .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.user_id, userId)))
    .orderBy(desc(orders.priority))
    .limit(1);

  let focus_streak = 0;
  if (topOrder) {
    const [match] = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(
        and(
          eq(feedback.order_id, topOrder.id),
          eq(feedback.completion_status, "completed"),
          gte(feedback.created_at, since),
        ),
      )
      .limit(1);
    focus_streak = match ? 1 : 0;
  }

  const return_streak = execution_streak > 0 ? Math.min(execution_streak, 3) : 0;

  return {
    execution_streak,
    return_streak,
    recovery_streak,
    truth_streak,
    focus_streak,
  };
}
