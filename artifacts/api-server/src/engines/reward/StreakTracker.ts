/**
 * DOC19 Task 4 — five streak metrics with shame-free persistence.
 */

import { db, feedback, orders, userStreaks, enforcementPackages, inactivityRecords } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { isVerifiedFeedbackEvidence } from "../identity/TransformationEvidenceCollector.js";
import type { RewardType } from "./rewardTypes.js";

export interface ExecutionStreaks {
  execution_streak: number;
  return_streak: number;
  recovery_streak: number;
  truth_streak: number;
  focus_streak: number;
}

const STREAK_TYPES = [
  "execution_streak",
  "return_streak",
  "recovery_streak",
  "truth_streak",
  "focus_streak",
] as const;

type StreakType = (typeof STREAK_TYPES)[number];

async function hasStreakFreeze(blueprintId?: string): Promise<boolean> {
  if (!blueprintId) return false;
  const [pkg] = await db
    .select({ feature_permissions: enforcementPackages.feature_permissions })
    .from(enforcementPackages)
    .where(
      and(
        eq(enforcementPackages.blueprint_id, blueprintId),
        eq(enforcementPackages.is_current, true),
      ),
    )
    .limit(1);

  const perms = (pkg?.feature_permissions ?? {}) as Record<string, boolean>;
  return perms.streak_freeze === true;
}

async function upsertStreak(userId: string, streakType: StreakType, count: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const [existing] = await db
    .select()
    .from(userStreaks)
    .where(and(eq(userStreaks.user_id, userId), eq(userStreaks.streak_type, streakType)))
    .limit(1);

  if (existing) {
    await db
      .update(userStreaks)
      .set({
        current_count: count,
        best_count: Math.max(existing.best_count ?? 0, count),
        last_activity_date: today,
        updated_at: new Date(),
      })
      .where(eq(userStreaks.id, existing.id));
    return;
  }

  await db.insert(userStreaks).values({
    user_id: userId,
    streak_type: streakType,
    current_count: count,
    best_count: count,
    last_activity_date: today,
  });
}

export async function computeStreaks(
  userId: string,
  blueprintId: string,
): Promise<ExecutionStreaks> {
  const since = new Date(Date.now() - 60 * 86400000);
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
    .limit(60);

  const dayBuckets = new Map<string, typeof rows>();
  for (const row of rows) {
    const day = row.created_at.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(day) ?? [];
    bucket.push(row);
    dayBuckets.set(day, bucket);
  }

  let execution_streak = 0;
  let cursor = new Date();
  for (let i = 0; i < 30; i++) {
    const day = cursor.toISOString().slice(0, 10);
    const dayRows = dayBuckets.get(day) ?? [];
    const accepted = dayRows.some(
      (r) => isVerifiedFeedbackEvidence(r) && r.completion_status === "completed",
    );
    if (accepted) {
      execution_streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else if (execution_streak > 0) {
      break;
    } else {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }

  let truth_streak = 0;
  for (const row of rows) {
    const honest =
      (row.completion_status === "failed" ||
        row.completion_status === "blocked" ||
        row.completion_status === "completed") &&
      row.validity === "valid" &&
      !row.gaming_flag;
    if (honest && (row.reflection ?? "").trim().length >= 10) {
      truth_streak++;
    } else if (truth_streak > 0) {
      break;
    }
  }

  let recovery_streak = 0;
  for (const row of rows) {
    const isRecovery =
      row.completion_status === "completed" &&
      (Boolean(row.failure_correction_type) || row.failure_classification === "recovery");
    if (isRecovery && isVerifiedFeedbackEvidence(row)) {
      recovery_streak++;
    } else if (recovery_streak > 0) {
      break;
    }
  }

  const twoDaysAgo = new Date(Date.now() - 48 * 3600000);
  const [recentStart] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.user_id, userId),
        eq(orders.blueprint_id, blueprintId),
        gte(orders.started_at, twoDaysAgo),
      ),
    )
    .limit(1);
  const return_streak = recentStart ? Math.min(execution_streak, 5) : 0;

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

  const freeze = await hasStreakFreeze(blueprintId);
  if (freeze && execution_streak === 0) {
    const [stored] = await db
      .select({ current_count: userStreaks.current_count, frozen_count: userStreaks.frozen_count })
      .from(userStreaks)
      .where(and(eq(userStreaks.user_id, userId), eq(userStreaks.streak_type, "execution_streak")))
      .limit(1);
    if (stored && (stored.frozen_count ?? 0) > 0) {
      execution_streak = stored.current_count ?? 0;
    }
  }

  return {
    execution_streak,
    return_streak,
    recovery_streak,
    truth_streak,
    focus_streak,
  };
}

/** Persist streak metrics after a reward is created. */
export async function updateStreakMetrics(
  userId: string,
  blueprintId: string | undefined,
  rewardType: RewardType,
): Promise<ExecutionStreaks | null> {
  if (!blueprintId) return null;

  const streaks = await computeStreaks(userId, blueprintId);
  await Promise.all(
    STREAK_TYPES.map((type) =>
      upsertStreak(userId, type, streaks[type as keyof ExecutionStreaks] ?? 0),
    ),
  );

  if (rewardType === "RECOVERY") {
    const [openInactivity] = await db
      .select({ id: inactivityRecords.id })
      .from(inactivityRecords)
      .where(
        and(
          eq(inactivityRecords.user_id, userId),
          eq(inactivityRecords.blueprint_id, blueprintId),
          eq(inactivityRecords.resolved, false),
        ),
      )
      .limit(1);
    if (!openInactivity) {
      await upsertStreak(userId, "recovery_streak", streaks.recovery_streak);
    }
  }

  return streaks;
}

/** Shame-free copy when streak resets — never say "lost". */
export function streakRestartMessage(): string {
  return "Start your streak again — here is your first step.";
}

export { computeStreaks as computeStreaksForBlueprint };
