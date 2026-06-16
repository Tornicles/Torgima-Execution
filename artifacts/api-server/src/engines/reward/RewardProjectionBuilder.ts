/**
 * DOC19 — dashboard-safe reward projection (no internal evidence IDs).
 */

import { db, rewardEvents } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { computeStreaks, streakRestartMessage } from "./StreakTracker.js";
import type { RewardIntensity, RewardType } from "./rewardTypes.js";

export interface RewardPanelView {
  latest_reward_title: string | null;
  latest_reward_message: string | null;
  latest_reward_type: string | null;
  latest_reward_intensity: RewardIntensity | null;
  pending_count: number;
  execution_streak: number;
  streak_message: string;
}

const FORBIDDEN_COPY = /\b(you crushed it|amazing|killing it|don't break your streak|you lost your streak)\b/i;

export function sanitizeRewardCopy(text: string): string {
  if (FORBIDDEN_COPY.test(text)) {
    return "Good work. Your next step is ready.";
  }
  return text;
}

export async function buildRewardPanelView(
  userId: string,
  blueprintId: string,
): Promise<RewardPanelView> {
  const [latest] = await db
    .select()
    .from(rewardEvents)
    .where(and(eq(rewardEvents.user_id, userId), eq(rewardEvents.blueprint_id, blueprintId)))
    .orderBy(desc(rewardEvents.created_at))
    .limit(1);

  const pending = await db
    .select({ id: rewardEvents.id })
    .from(rewardEvents)
    .where(
      and(
        eq(rewardEvents.user_id, userId),
        eq(rewardEvents.blueprint_id, blueprintId),
        eq(rewardEvents.delivered, false),
      ),
    );

  const streaks = await computeStreaks(userId, blueprintId);

  return {
    latest_reward_title: latest ? sanitizeRewardCopy(latest.title) : null,
    latest_reward_message: latest
      ? sanitizeRewardCopy(latest.message ?? latest.description ?? "")
      : null,
    latest_reward_type: (latest?.reward_type as RewardType | undefined) ?? null,
    latest_reward_intensity: (latest?.intensity as RewardIntensity | undefined) ?? null,
    pending_count: pending.length,
    execution_streak: streaks.execution_streak,
    streak_message:
      streaks.execution_streak > 0
        ? "Consistent execution builds real results."
        : streakRestartMessage(),
  };
}

export function toDashboardRewardSummary(panel: RewardPanelView) {
  return {
    type: panel.latest_reward_type,
    intensity: panel.latest_reward_intensity,
    message: panel.latest_reward_message,
    title: panel.latest_reward_title,
    executionStreak: panel.execution_streak,
    streakMessage: panel.streak_message,
    pendingCount: panel.pending_count,
  };
}
