/**
 * DOC21 Task 1 — normalize feedback/orders into windowed behavioral evidence.
 */

export type RawFeedbackRow = {
  id: string;
  created_at: Date;
  completion_status: string;
  score: number | null;
  friction_score: number | null;
  confidence_score: number | null;
  duration_minutes: number | null;
  late_penalty_applied: boolean;
  reflection: string | null;
  order_id: string;
  taskDifficulty: string | null;
  taskType: string | null;
  orderStartedAt: Date | null;
  orderCreatedAt: Date;
  submitted_hours_after_completion: number | null;
};

export type RawOrderRow = {
  id: string;
  created_at: Date;
  started_at: Date | null;
  task_type: string | null;
  difficulty: string | null;
};

export type WindowMetrics = {
  windowDays: number;
  feedbackCount: number;
  completionRate: number;
  acceptedCount: number;
  consistencyPct: number;
  delaySubmissionCount: number;
  difficultyFailureCount: number;
  blockedCount: number;
  failedCount: number;
  skippedCount: number;
  avgFriction: number;
  avgConfidence: number;
  avgDurationMinutes: number;
  completionByTaskType: Map<string, { completed: number; total: number; skipped: number; failed: number }>;
};

export type NormalizedBehaviorEvidence = {
  w3: WindowMetrics;
  w7: WindowMetrics;
  w14: WindowMetrics;
  w30: WindowMetrics;
  /** Sorted oldest-first for trend detection. */
  recentFeedbackChronological: RawFeedbackRow[];
  consecutive7DayCompletionRates: number[];
  hasOpenInactivity: boolean;
  inactivityCount30d: number;
  recoveryResolvedWithin3Days: number;
};

const MS_DAY = 86400000;
const DELAY_THRESHOLD_HOURS = 18;

function hoursAfterTaskStart(row: RawFeedbackRow): number {
  if (row.submitted_hours_after_completion != null) {
    return row.submitted_hours_after_completion;
  }
  const start = row.orderStartedAt ?? row.orderCreatedAt;
  return (row.created_at.getTime() - start.getTime()) / 3600000;
}

function isAccepted(row: RawFeedbackRow): boolean {
  return row.completion_status === "completed" && (row.score ?? 0) >= 7;
}

function buildWindowMetrics(
  rows: RawFeedbackRow[],
  windowDays: number,
  now: Date,
): WindowMetrics {
  const since = new Date(now.getTime() - windowDays * MS_DAY);
  const windowRows = rows.filter((r) => r.created_at >= since);
  const total = windowRows.length;
  const completed = windowRows.filter((r) => r.completion_status === "completed").length;
  const accepted = windowRows.filter(isAccepted).length;
  const failed = windowRows.filter((r) => r.completion_status === "failed").length;
  const blocked = windowRows.filter((r) => r.completion_status === "blocked").length;
  const skipped = windowRows.filter((r) => r.completion_status === "skipped").length;

  const delaySubmissionCount = windowRows.filter(
    (r) => hoursAfterTaskStart(r) > DELAY_THRESHOLD_HOURS,
  ).length;

  const difficultyFailureCount = windowRows.filter(
    (r) =>
      (r.completion_status === "failed" || r.completion_status === "blocked") &&
      ["hard", "very_hard"].includes((r.taskDifficulty ?? "").toLowerCase()),
  ).length;

  const avgFriction =
    total > 0
      ? windowRows.reduce((s, r) => s + (r.friction_score ?? 0), 0) / total
      : 0;
  const avgConfidence =
    total > 0
      ? windowRows.reduce((s, r) => s + (r.confidence_score ?? 5), 0) / total
      : 5;
  const durations = windowRows.filter((r) => (r.duration_minutes ?? 0) > 0);
  const avgDurationMinutes =
    durations.length > 0
      ? durations.reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / durations.length
      : 0;

  const completionByTaskType = new Map<
    string,
    { completed: number; total: number; skipped: number; failed: number }
  >();
  for (const row of windowRows) {
    const type = row.taskType ?? "unknown";
    const bucket = completionByTaskType.get(type) ?? {
      completed: 0,
      total: 0,
      skipped: 0,
      failed: 0,
    };
    bucket.total++;
    if (row.completion_status === "completed") bucket.completed++;
    if (row.completion_status === "skipped") bucket.skipped++;
    if (row.completion_status === "failed") bucket.failed++;
    completionByTaskType.set(type, bucket);
  }

  const dayBuckets = new Map<string, { completed: number; total: number }>();
  for (const row of windowRows) {
    const day = row.created_at.toISOString().slice(0, 10);
    const b = dayBuckets.get(day) ?? { completed: 0, total: 0 };
    b.total++;
    if (row.completion_status === "completed") b.completed++;
    dayBuckets.set(day, b);
  }
  const dayRates = [...dayBuckets.values()].map((b) => b.completed / Math.max(1, b.total));
  const consistencyPct =
    dayRates.length > 0
      ? (dayRates.filter((r) => r >= 0.5).length / dayRates.length) * 100
      : 0;

  return {
    windowDays,
    feedbackCount: total,
    completionRate: total > 0 ? completed / total : 0,
    acceptedCount: accepted,
    consistencyPct,
    delaySubmissionCount,
    difficultyFailureCount,
    blockedCount: blocked,
    failedCount: failed,
    skippedCount: skipped,
    avgFriction,
    avgConfidence,
    avgDurationMinutes,
    completionByTaskType,
  };
}

function consecutive7DayCompletionRates(rows: RawFeedbackRow[], now: Date): number[] {
  const rates: number[] = [];
  for (let i = 0; i < 4; i++) {
    const end = new Date(now.getTime() - i * 7 * MS_DAY);
    const start = new Date(end.getTime() - 7 * MS_DAY);
    const slice = rows.filter((r) => r.created_at >= start && r.created_at < end);
    if (slice.length === 0) continue;
    rates.unshift(
      slice.filter((r) => r.completion_status === "completed").length / slice.length,
    );
  }
  return rates;
}

export function normalizeBehaviorEvidence(params: {
  feedbackRows: RawFeedbackRow[];
  orderRows?: RawOrderRow[];
  hasOpenInactivity?: boolean;
  inactivityCount30d?: number;
  recoveryResolvedWithin3Days?: number;
  now?: Date;
}): NormalizedBehaviorEvidence {
  const now = params.now ?? new Date();
  const rows = [...params.feedbackRows].sort(
    (a, b) => a.created_at.getTime() - b.created_at.getTime(),
  );

  return {
    w3: buildWindowMetrics(rows, 3, now),
    w7: buildWindowMetrics(rows, 7, now),
    w14: buildWindowMetrics(rows, 14, now),
    w30: buildWindowMetrics(rows, 30, now),
    recentFeedbackChronological: rows,
    consecutive7DayCompletionRates: consecutive7DayCompletionRates(rows, now),
    hasOpenInactivity: params.hasOpenInactivity ?? false,
    inactivityCount30d: params.inactivityCount30d ?? 0,
    recoveryResolvedWithin3Days: params.recoveryResolvedWithin3Days ?? 0,
  };
}

export function joinFeedbackWithOrders(
  feedbackRows: Array<Omit<RawFeedbackRow, "orderStartedAt" | "orderCreatedAt"> & {
    orderStartedAt?: Date | null;
    orderCreatedAt?: Date;
  }>,
  orderRows: RawOrderRow[],
): RawFeedbackRow[] {
  const orderMap = new Map(orderRows.map((o) => [o.id, o]));
  return feedbackRows.map((f) => {
    const order = orderMap.get(f.order_id);
    return {
      ...f,
      orderStartedAt: f.orderStartedAt ?? order?.started_at ?? null,
      orderCreatedAt: f.orderCreatedAt ?? order?.created_at ?? f.created_at,
    };
  });
}
