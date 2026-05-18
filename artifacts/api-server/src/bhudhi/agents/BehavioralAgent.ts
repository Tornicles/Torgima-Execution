import { db, feedback, orders } from "@workspace/db";
import { and, eq, gte, desc, inArray } from "drizzle-orm";

export interface BasicBehavioralProfile {
  userId: string;
  completionRateLast7Days: number;
  averageScoreLast7Days: number;
  consecutiveCompletions: number;
  consecutiveFailures: number;
  lastActiveAt: Date | null;
  inactiveHours: number;
  burnoutRisk: null;
  procrastinationProfile: null;
  frictionTopology: null;
}

export async function getBasicProfile(userId: string): Promise<BasicBehavioralProfile> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentFeedback = await db
    .select({
      completion_status: feedback.completion_status,
      score: feedback.score,
      created_at: feedback.created_at,
    })
    .from(feedback)
    .where(and(eq(feedback.user_id, userId), gte(feedback.created_at, since)))
    .orderBy(desc(feedback.created_at))
    .limit(50);

  const completed = recentFeedback.filter(f => f.completion_status === "completed").length;
  const total = recentFeedback.length || 1;
  const completionRate = completed / total;

  const scores = recentFeedback
    .map(f => f.score)
    .filter((s): s is number => typeof s === "number");
  const averageScore =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;

  let consecutiveCompletions = 0;
  let consecutiveFailures = 0;
  for (const row of recentFeedback) {
    if (row.completion_status === "completed") {
      if (consecutiveFailures > 0) break;
      consecutiveCompletions++;
    } else if (row.completion_status === "failed" || row.completion_status === "skipped") {
      if (consecutiveCompletions > 0) break;
      consecutiveFailures++;
    } else break;
  }

  const [lastOrder] = await db
    .select({ finished_at: orders.finished_at, updated_at: orders.updated_at })
    .from(orders)
    .where(and(eq(orders.user_id, userId), inArray(orders.status, ["completed", "active", "pending"])))
    .orderBy(desc(orders.updated_at))
    .limit(1);

  const lastActiveAt = lastOrder?.finished_at ?? lastOrder?.updated_at ?? null;
  const inactiveHours = lastActiveAt
    ? (Date.now() - lastActiveAt.getTime()) / (60 * 60 * 1000)
    : 999;

  return {
    userId,
    completionRateLast7Days: completionRate,
    averageScoreLast7Days: averageScore,
    consecutiveCompletions,
    consecutiveFailures,
    lastActiveAt,
    inactiveHours,
    burnoutRisk: null,
    procrastinationProfile: null,
    frictionTopology: null,
  };
}

export async function detectInactivity(
  userId: string,
): Promise<{ isInactive: boolean; inactiveHours: number }> {
  const profile = await getBasicProfile(userId);
  return {
    isInactive: profile.inactiveHours >= 48,
    inactiveHours: profile.inactiveHours,
  };
}

export async function detectBasicBurnoutSignal(
  userId: string,
): Promise<{ risk: "LOW" | "MEDIUM" | "HIGH"; signal: string }> {
  const p = await getBasicProfile(userId);
  if (p.consecutiveFailures >= 3 && p.completionRateLast7Days < 0.35) {
    return { risk: "MEDIUM", signal: "Repeated failures with low weekly completion rate" };
  }
  if (p.averageScoreLast7Days < 4 && p.consecutiveFailures >= 2) {
    return { risk: "MEDIUM", signal: "Low scores with failure streak" };
  }
  return { risk: "LOW", signal: "No elevated burnout pattern in Phase 1 heuristics" };
}
