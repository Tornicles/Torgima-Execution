import { db, feedback, signalSnapshots } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import type { SignalMetrics as ExportedSignalMetrics } from "./SignalCalculationEngine.types.js";

export type SignalMetrics = ExportedSignalMetrics;

// ── CONDITION LEVELS ──────────────────────────────────────────────────────────
export const CONDITION_LEVELS: Record<string, number> = {
  nothingness: 0,
  danger: 1,
  urgency: 2,
  stability: 3,
  power: 4,
  affluence: 5,
};

function normalizeTrendForDb(trend: string): NonNullable<typeof signalSnapshots.$inferInsert["trend"]> {
  if (trend === "flat") return "stable";
  if (
    trend === "rising" ||
    trend === "stable" ||
    trend === "declining" ||
    trend === "recovering"
  ) {
    return trend;
  }
  return "volatile";
}

/** Normalize numeric snapshot metrics before inserting into `signal_snapshots`. */
export function sanitizeNumericSignalMetrics(metrics: SignalMetrics): {
  completion_rate: number;
  weighted_score: number;
  momentum: number;
  blocker_ratio: number;
  skip_ratio: number;
  trend: typeof signalSnapshots.$inferInsert["trend"];
  confidence: typeof signalSnapshots.$inferInsert["confidence"];
} {
  const boundedRate = Math.min(1, Math.max(0, metrics.completion_rate));
  const boundedWeighted = Math.min(10, Math.max(0, metrics.weighted_score));
  return {
    completion_rate: boundedRate,
    weighted_score: boundedWeighted,
    momentum: metrics.momentum,
    blocker_ratio: Math.min(1, Math.max(0, metrics.blocker_ratio)),
    skip_ratio: Math.min(1, Math.max(0, metrics.skip_ratio)),
    trend: normalizeTrendForDb(metrics.trend),
    confidence: metrics.confidence as typeof signalSnapshots.$inferInsert["confidence"],
  };
}

// ── MAIN CALCULATION ──────────────────────────────────────────────────────────

export async function calculate(params: {
  blueprintId: string;
  userId: string;
  causationEventId?: string;
}): Promise<{ snapshotId: string; condition: string; metrics: SignalMetrics }> {
  const now = new Date();
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const priorEnd = windowStart;
  const priorStart = new Date(priorEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const feedbackInWindow = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.blueprint_id, params.blueprintId),
        eq(feedback.user_id, params.userId),
        gte(feedback.created_at, windowStart),
        lte(feedback.created_at, windowEnd),
      ),
    )
    .orderBy(feedback.created_at);

  const priorFeedback = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.blueprint_id, params.blueprintId),
        eq(feedback.user_id, params.userId),
        gte(feedback.created_at, priorStart),
        lte(feedback.created_at, priorEnd),
      ),
    );

  const metrics = calculateMetrics(feedbackInWindow, priorFeedback);

  const [prevSnapshot] = await db
    .select()
    .from(signalSnapshots)
    .where(
      and(eq(signalSnapshots.blueprint_id, params.blueprintId), eq(signalSnapshots.is_current, true)),
    )
    .limit(1);

  const prevCondition = prevSnapshot?.assigned_condition ?? "nothingness";

  const assignedCondition = assignCondition(metrics, prevCondition ?? "nothingness");

  const sanitized = sanitizeNumericSignalMetrics(metrics);

  const snapshotId = await db.transaction(async (tx) => {
    await tx
      .update(signalSnapshots)
      .set({ is_current: false })
      .where(
        and(eq(signalSnapshots.blueprint_id, params.blueprintId), eq(signalSnapshots.is_current, true)),
      );

    const [snapshot] = await tx
      .insert(signalSnapshots)
      .values({
        blueprint_id: params.blueprintId,
        user_id: params.userId,
        window_start: windowStart,
        window_end: windowEnd,
        completion_rate: sanitized.completion_rate,
        weighted_score: sanitized.weighted_score,
        momentum: sanitized.momentum,
        trend: sanitized.trend,
        confidence: sanitized.confidence,
        blocker_ratio: sanitized.blocker_ratio,
        skip_ratio: sanitized.skip_ratio,
        assigned_condition: assignedCondition as typeof signalSnapshots.$inferInsert["assigned_condition"],
        is_current: true,
        ...(params.causationEventId ? { causation_event_id: params.causationEventId } : {}),
      })
      .returning({ id: signalSnapshots.id });

    if (!snapshot) throw new Error("Failed to create signal snapshot");
    return snapshot.id;
  });

  logger.info(
    {
      blueprintId: params.blueprintId,
      condition: assignedCondition,
      rate:        metrics.completion_rate.toFixed(2),
      score:       metrics.weighted_score.toFixed(1),
      momentum:    metrics.momentum,
      trend:       metrics.trend,
    },
    "[SignalEngine] Snapshot created",
  );

  return { snapshotId, condition: assignedCondition, metrics };
}

// ── METRIC CALCULATIONS ───────────────────────────────────────────────────────

export function calculateMetrics(
  rows: (typeof feedback.$inferSelect)[],
  priorRows: (typeof feedback.$inferSelect)[],
): SignalMetrics {
  const completionRate = calcCompletionRate(rows);
  const weightedScore = calcWeightedScore(rows);
  const rawScore = calcRawScore(rows);
  const momentum = calcMomentum(rows);
  const confidence = calcConfidence(rows);
  const blockerRatio = calcBlockerRatio(rows);
  const skipRatio = calcSkipRatio(rows);
  const avgDifficulty = calcAvgDifficulty(rows);
  const trend = calcTrend(
    weightedScore,
    calcWeightedScore(priorRows),
    completionRate,
    calcCompletionRate(priorRows),
    priorRows.length,
  );

  return {
    completion_rate:    completionRate,
    weighted_score:     weightedScore,
    raw_score:          rawScore,
    momentum,
    trend,
    confidence,
    blocker_ratio:      blockerRatio,
    skip_ratio:         skipRatio,
    tasks_in_window:    rows.length,
    avg_difficulty_felt: avgDifficulty,
  };
}

export function calcCompletionRate(rows: (typeof feedback.$inferSelect)[]): number {
  if (rows.length === 0) return 0;
  const completed = rows.filter(
    (f) => f.completion_status === "completed" || f.completion_status === "partial",
  ).length;
  return completed / rows.length;
}

export function calcWeightedScore(rows: (typeof feedback.$inferSelect)[]): number {
  if (rows.length === 0) return 0;
  const totalWeight = rows.reduce((sum, f) => {
    const w = f.weighted_score ?? f.score ?? 0;
    return sum + w;
  }, 0);
  return totalWeight / rows.length;
}

export function calcRawScore(rows: (typeof feedback.$inferSelect)[]): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, f) => sum + (f.score ?? 0), 0);
  return total / rows.length;
}

export function calcMomentum(rows: (typeof feedback.$inferSelect)[]): number {
  if (rows.length === 0) return 0;

  const completionDates = new Set(
    rows
      .filter((f) => f.completion_status === "completed" || f.completion_status === "partial")
      .map((f) => {
        const d = new Date(f.created_at);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      }),
  );

  if (completionDates.size === 0) return 0;

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (completionDates.has(key)) {
      streak++;
    } else if (streak > 0) {
      break;
    }
  }
  return streak;
}

export function calcTrend(
  currentScore: number,
  priorScore: number,
  currentRate: number,
  priorRate: number,
  priorCount: number,
): string {
  if (priorCount === 0) return "flat";

  const scoreDelta = currentScore - priorScore;
  const rateDelta = currentRate - priorRate;

  const wasLow = priorScore < 5.0 || priorRate < 0.4;
  const improving = scoreDelta > 0.5 || rateDelta > 0.05;

  if (wasLow && improving) return "recovering";
  if (scoreDelta >= 1.0 || rateDelta >= 0.1) return "rising";
  if (scoreDelta <= -1.0 || rateDelta <= -0.1) return "declining";
  return "stable";
}

export function calcConfidence(rows: (typeof feedback.$inferSelect)[]): string {
  const count = rows.length;
  if (count === 0) return "insufficient_data";
  if (count < 3) return "low";

  const gamingCount = rows.filter((f) => f.gaming_flag).length;
  const gamingRatio = gamingCount / count;
  if (gamingRatio > 0.3) return "low";

  const scores = rows.map((f) => f.score ?? 0);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev > 3.5 && count < 6) return "low";
  if (count >= 6) return gamingRatio > 0.15 ? "medium" : "high";
  return "medium";
}

export function calcBlockerRatio(rows: (typeof feedback.$inferSelect)[]): number {
  if (rows.length === 0) return 0;
  const blocked = rows.filter((f) => {
    const b = f.blocker_json;
    return b !== null && typeof b === "object" && Object.keys(b as object).length > 0;
  }).length;
  return blocked / rows.length;
}

export function calcSkipRatio(rows: (typeof feedback.$inferSelect)[]): number {
  if (rows.length === 0) return 0;
  const skipped = rows.filter((f) => f.completion_status === "skipped").length;
  return skipped / rows.length;
}

function calcAvgDifficulty(rows: (typeof feedback.$inferSelect)[]): string | null {
  if (rows.length === 0) return null;
  const counts: Record<string, number> = {};
  rows.forEach((f) => {
    const felt = (f as { difficulty_felt?: string | null }).difficulty_felt;
    if (felt) counts[felt] = (counts[felt] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// ── CONDITION ASSIGNMENT ──────────────────────────────────────────────────────

export function assignCondition(metrics: SignalMetrics, _previousCondition: string): string {
  const { completion_rate, weighted_score, momentum, trend, confidence, tasks_in_window } = metrics;

  if (
    confidence === "insufficient_data" ||
    tasks_in_window < 3 ||
    (completion_rate < 0.1 && weighted_score < 2.0)
  )
    return "nothingness";

  if (
    completion_rate < 0.3 &&
    weighted_score < 4.0 &&
    (trend === "declining" || momentum === 0)
  )
    return "danger";

  if (
    completion_rate >= 0.3 &&
    completion_rate < 0.5 &&
    weighted_score >= 4.0 &&
    weighted_score < 5.5 &&
    (trend === "flat" || trend === "declining")
  )
    return "urgency";

  if (
    completion_rate >= 0.5 &&
    completion_rate < 0.7 &&
    weighted_score >= 5.5 &&
    weighted_score < 7.0 &&
    (trend === "stable" || trend === "recovering")
  )
    return "stability";

  if (
    completion_rate >= 0.7 &&
    completion_rate < 0.85 &&
    weighted_score >= 7.0 &&
    weighted_score < 8.5 &&
    (trend === "stable" || trend === "rising") &&
    momentum >= 3
  )
    return "power";

  if (completion_rate > 0.85 && weighted_score > 8.5 && trend === "rising" && momentum >= 7)
    return "affluence";

  if (completion_rate < 0.3) return "danger";
  if (completion_rate < 0.5) return "urgency";
  if (completion_rate < 0.7) return "stability";
  if (completion_rate < 0.85) return "power";
  return "affluence";
}

/** Rank for delta checks; `power_change` is treated as stability-tier volatility. */
function conditionRankForDelta(c: string): number {
  if (c === "power_change") return CONDITION_LEVELS["stability"]!;
  return CONDITION_LEVELS[c] ?? -1;
}

/** True when condition level delta is ≥ 2 (power_change gate). */
export function isPowerChange(newCondition: string, previousCondition: string): boolean {
  const nl = conditionRankForDelta(newCondition);
  const pl = conditionRankForDelta(previousCondition);
  if (nl < 0 || pl < 0) return false;
  return Math.abs(nl - pl) >= 2;
}

export function explainSignal(metrics: SignalMetrics, condition: string): string {
  const rate = Math.round(metrics.completion_rate * 100);
  const score = metrics.weighted_score.toFixed(1);
  const conditionMessages: Record<string, string> = {
    nothingness: `Execution has not started or has no data yet. ${rate}% completion rate.`,
    danger:      `Execution is struggling. ${rate}% completion rate, ${score}/10 score. Decline detected.`,
    urgency:     `Execution is unstable. ${rate}% completion rate, ${score}/10 score. Consistency needed.`,
    stability:   `Execution is consistent. ${rate}% completion rate, ${score}/10 score. Maintain and improve.`,
    power:       `Execution is strong. ${rate}% completion rate, ${score}/10 score. ${metrics.momentum}-day streak.`,
    affluence:   `Execution is excellent. ${rate}% completion rate, ${score}/10 score. ${metrics.momentum}-day streak.`,
    power_change:`Execution state is shifting rapidly. Recent performance change detected.`,
  };
  return conditionMessages[condition] ?? `Condition: ${condition}.`;
}
