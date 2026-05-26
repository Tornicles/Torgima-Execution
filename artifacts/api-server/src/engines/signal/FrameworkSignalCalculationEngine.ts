/**
 * SIGNAL_SYSTEM_SPECIFICATION.md — Production, Operations, Growth, Scale from last N feedbacks.
 */
import type { feedback as feedbackTable } from "@workspace/db";
import type {
  CalculatedFrameworkSignal,
  FrameworkSignalsBundle,
  PermanentSignalKey,
  SignalTrend,
} from "../../types/framework-signals.js";
import { PERMANENT_SIGNAL_KEYS } from "../../types/framework-signals.js";

export const SIGNAL_FEEDBACK_WINDOW = 10;

type FeedbackRow = typeof feedbackTable.$inferSelect;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = avg(nums);
  const v = nums.reduce((acc, n) => acc + (n - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

function hasBlocker(row: FeedbackRow): boolean {
  const b = row.blocker_json;
  return b !== null && typeof b === "object" && Object.keys(b as object).length > 0;
}

function scoreOf(row: FeedbackRow): number {
  if (row.score != null && row.score > 0) return row.score;
  if (row.weighted_score != null) return row.weighted_score;
  return 5;
}

export function signalConfidenceFromSampleCount(count: number): number {
  return clamp01(0.3 + Math.min(SIGNAL_FEEDBACK_WINDOW, count) * 0.06);
}

export function interpretSignalValue(key: PermanentSignalKey, value: number): string {
  const v = value;
  if (key === "Production") {
    if (v >= 0.9) return "Excellent";
    if (v >= 0.7) return "Good";
    if (v >= 0.5) return "Acceptable";
    if (v >= 0.3) return "Poor";
    return "Critical";
  }
  if (key === "Operations") {
    if (v >= 0.8) return "Excellent";
    if (v >= 0.6) return "Good";
    if (v >= 0.4) return "Acceptable";
    if (v >= 0.2) return "Poor";
    return "Critical";
  }
  if (key === "Growth") {
    if (v >= 0.7) return "Excellent";
    if (v >= 0.5) return "Good";
    if (v >= 0.3) return "Acceptable";
    if (v >= 0.1) return "Poor";
    return "Stalled";
  }
  if (v >= 0.8) return "Excellent";
  if (v >= 0.6) return "Good";
  if (v >= 0.4) return "Acceptable";
  if (v >= 0.2) return "Poor";
  return "Critical";
}

/** Production = (Completed + 0.5 × Partial) / Total */
export function calculateProduction(rows: FeedbackRow[]): number {
  if (rows.length === 0) return 0.5;
  const completed = rows.filter((f) => f.completion_status === "completed").length;
  const partial = rows.filter((f) => f.completion_status === "partial").length;
  return clamp01((completed + 0.5 * partial) / rows.length);
}

/** Operations = (avgScore/10) × (1 - blockerCount/total) */
export function calculateOperations(rows: FeedbackRow[]): number {
  if (rows.length === 0) return 0.5;
  const scores = rows.map(scoreOf);
  const avgScore = avg(scores) / 10;
  const blockerCount = rows.filter(hasBlocker).length;
  const blockerFactor = 1 - blockerCount / rows.length;
  return clamp01(avgScore * blockerFactor);
}

function scoreTrendComponent(rows: FeedbackRow[]): number {
  if (rows.length < 4) return 0;
  const scores = rows.map(scoreOf);
  const half = Math.max(1, Math.floor(scores.length / 2));
  const recentAvg = avg(scores.slice(0, half));
  const olderAvg = avg(scores.slice(half));
  if (recentAvg > olderAvg + 0.5) return 0.1;
  if (recentAvg < olderAvg - 0.5) return -0.1;
  return 0;
}

function blockerResolutionRate(rows: FeedbackRow[]): number {
  const withBlocker = rows.filter(hasBlocker);
  if (withBlocker.length === 0) return 0.5;
  const resolved = withBlocker.filter((f) => f.completion_status === "completed").length;
  return clamp01(resolved / withBlocker.length);
}

function learningQuality(rows: FeedbackRow[]): number {
  if (rows.length === 0) return 0.5;
  const scored = rows.map((f) => {
    let q = 0.35;
    const reflection = f.reflection?.trim() ?? "";
    if (reflection.length > 40) q += 0.35;
    else if (reflection.length > 10) q += 0.2;
    const proof = f.proof_json as Record<string, unknown> | null;
    if (proof && Object.keys(proof).length > 0) q += 0.1;
    return clamp01(q);
  });
  return clamp01(avg(scored));
}

/** Growth = trend×0.4 + blockerResolution×0.3 + learning×0.3 */
export function calculateGrowth(rows: FeedbackRow[]): number {
  if (rows.length === 0) return 0.5;
  const trend = scoreTrendComponent(rows);
  const resolution = blockerResolutionRate(rows);
  const learning = learningQuality(rows);
  const raw = trend * 0.4 + resolution * 0.3 + learning * 0.3;
  return clamp01(raw);
}

function blockerRecurrence(rows: FeedbackRow[]): number {
  const seen = new Map<string, number>();
  let repeats = 0;
  for (const f of rows) {
    if (!hasBlocker(f)) continue;
    const key = JSON.stringify(f.blocker_json);
    const prev = seen.get(key) ?? 0;
    if (prev > 0) repeats++;
    seen.set(key, prev + 1);
  }
  return clamp01(repeats / Math.max(1, rows.length));
}

/** Scale = 1 - (scoreVar + timingVar + blockerRecurrence) / 3 */
export function calculateScale(rows: FeedbackRow[]): number {
  if (rows.length === 0) return 0.5;
  const scores = rows.map(scoreOf);
  const scoreVariance = clamp01(stdDev(scores) / 10);
  const skipped = rows.filter((f) => f.completion_status === "skipped").length;
  const timingVariance = clamp01(skipped / rows.length);
  const recurrence = blockerRecurrence(rows);
  return clamp01(1 - (scoreVariance + timingVariance + recurrence) / 3);
}

export function trendFromMomentum(momentum: number): SignalTrend {
  if (momentum > 0.02) return "improving";
  if (momentum < -0.02) return "declining";
  return "stable";
}

export function trendFromHistory(historyValues: number[]): SignalTrend {
  if (historyValues.length < 4) return "stable";
  const recent = avg(historyValues.slice(-5));
  const prior = avg(historyValues.slice(-10, -5));
  if (recent > prior + 0.03) return "improving";
  if (recent < prior - 0.03) return "declining";
  return "stable";
}

export function calculateFrameworkSignalsFromFeedback(
  rows: FeedbackRow[],
  prior?: Partial<Record<PermanentSignalKey, number>>,
): FrameworkSignalsBundle {
  const window = rows.slice(0, SIGNAL_FEEDBACK_WINDOW);
  const count = window.length;
  const confidence = signalConfidenceFromSampleCount(count);

  const values: Record<PermanentSignalKey, number> = {
    Production: calculateProduction(window),
    Operations: calculateOperations(window),
    Growth: calculateGrowth(window),
    Scale: calculateScale(window),
  };

  const signals = {} as Record<PermanentSignalKey, CalculatedFrameworkSignal>;

  for (const key of PERMANENT_SIGNAL_KEYS) {
    const value = values[key];
    const previousValue = prior?.[key] ?? value;
    const momentum = value - previousValue;
    const trend = trendFromMomentum(momentum);
    signals[key] = {
      key,
      value,
      previousValue,
      momentum,
      change: momentum,
      trend,
      confidence,
      statusLabel: interpretSignalValue(key, value),
      metadata: buildMetadata(key, window, values),
      valueHistory: {},
    };
  }

  return {
    signals,
    feedbackCount: count,
    calculatedAt: new Date().toISOString(),
  };
}

function buildMetadata(
  key: PermanentSignalKey,
  rows: FeedbackRow[],
  values: Record<PermanentSignalKey, number>,
): Record<string, unknown> {
  if (key === "Production") {
    return {
      completed: rows.filter((f) => f.completion_status === "completed").length,
      partial: rows.filter((f) => f.completion_status === "partial").length,
      failed: rows.filter((f) => f.completion_status === "failed").length,
      skipped: rows.filter((f) => f.completion_status === "skipped").length,
      total: rows.length,
    };
  }
  if (key === "Operations") {
    return {
      average_score: avg(rows.map(scoreOf)),
      blocker_count: rows.filter(hasBlocker).length,
    };
  }
  if (key === "Growth") {
    return {
      score_trend: scoreTrendComponent(rows),
      blocker_resolution_rate: blockerResolutionRate(rows),
      learning_quality: learningQuality(rows),
    };
  }
  const scores = rows.map(scoreOf);
  return {
    score_variance: clamp01(stdDev(scores) / 10),
    timing_variance: clamp01(
      rows.filter((f) => f.completion_status === "skipped").length / Math.max(1, rows.length),
    ),
    blocker_recurrence: blockerRecurrence(rows),
    all_signals: values,
  };
}

export function bundleToEngineMetrics(bundle: FrameworkSignalsBundle): {
  production_signal: number;
  operations_signal: number;
  growth_signal: number;
  scale_signal: number;
  momentum: number;
} {
  const prod = bundle.signals.Production;
  const avgMomentum =
    (prod.momentum +
      bundle.signals.Operations.momentum +
      bundle.signals.Growth.momentum +
      bundle.signals.Scale.momentum) /
    4;
  return {
    production_signal: prod.value,
    operations_signal: bundle.signals.Operations.value,
    growth_signal: bundle.signals.Growth.value,
    scale_signal: bundle.signals.Scale.value,
    momentum: avgMomentum,
  };
}
