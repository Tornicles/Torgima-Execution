/**
 * Phase 4 DOC 21 — pattern dimension scores and fatigue risk formula.
 */

export interface PatternScoreBundle {
  frequencyScore: number;
  severityScore: number;
  trendScore: number;
  consistencyScore: number;
  riskScore: number;
}

export function calculatePatternScores(input: {
  occurrenceCount: number;
  windowSize: number;
  impactOnCompletion: number;
  trendDelta: number;
  crossTypeStability: number;
}): PatternScoreBundle {
  const frequencyScore = Math.min(1, input.occurrenceCount / Math.max(1, input.windowSize));
  const severityScore = Math.min(1, Math.max(0, input.impactOnCompletion));
  const trendScore = Math.max(-1, Math.min(1, input.trendDelta));
  const consistencyScore = Math.min(1, Math.max(0, input.crossTypeStability));
  const riskScore = Math.min(
    1,
    frequencyScore * 0.3 + severityScore * 0.35 + Math.max(0, trendScore) * 0.2 + (1 - consistencyScore) * 0.15,
  );
  return { frequencyScore, severityScore, trendScore, consistencyScore, riskScore };
}

type RecentTaskLike = {
  effortScore?: number | null;
  notesLength?: number;
  durationMinutes?: number | null;
  timeEstimate?: number | null;
};

/** DOC 21 §1.3 — composite fatigue / strain risk (not clinical diagnosis). */
export function computeSpecFatigueRiskScore(params: {
  prev7dCompletionRate: number;
  curr3dCompletionRate: number;
  recentTasks: RecentTaskLike[];
  hardTasksLast3d: number;
  inactivityAfterIntensity: boolean;
}): number {
  const prev = Math.max(params.prev7dCompletionRate, 0.01);
  const completionDrop = (prev - params.curr3dCompletionRate) / prev;

  const tasks = params.recentTasks;
  const n = Math.max(tasks.length, 1);
  const scoreInflation =
    tasks.filter((t) => t.effortScore === 5 && (t.notesLength ?? 0) < 20).length / n;
  const speedGaming =
    tasks.filter(
      (t) =>
        (t.durationMinutes ?? 0) > 0 &&
        (t.timeEstimate ?? 30) > 0 &&
        (t.durationMinutes ?? 0) < (t.timeEstimate ?? 30) * 0.3,
    ).length / n;
  const inactivityAfterIntensity =
    params.hardTasksLast3d >= 3 && params.inactivityAfterIntensity ? 1 : 0;

  return (
    0.35 * Math.max(0, completionDrop) +
    0.25 * scoreInflation +
    0.2 * speedGaming +
    0.2 * inactivityAfterIntensity
  );
}

export function consecutiveCompletedDays(
  feedbackByDay: Map<string, { completed: number; total: number }>,
): number {
  const days = [...feedbackByDay.keys()].sort();
  let streak = 0;
  let maxStreak = 0;
  for (const day of days) {
    const bucket = feedbackByDay.get(day)!;
    if (bucket.completed > 0 && bucket.completed / Math.max(1, bucket.total) >= 0.5) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }
  return maxStreak;
}
