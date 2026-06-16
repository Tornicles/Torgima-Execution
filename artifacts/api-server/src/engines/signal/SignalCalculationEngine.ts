import {
  db,
  feedback,
  signalSnapshots,
  orders,
  targets,
  blueprints,
  activeFeedbackSessions,
} from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { SignalMetrics as ExportedSignalMetrics } from "./SignalCalculationEngine.types.js";
import type { OperationalMathematicsDocument } from "./SignalOperationalMathematicsEngine.js";
import { computeOperationalMathematics } from "./SignalOperationalMathematicsEngine.js";
import { assignConditionFromMetrics } from "../condition/ConditionDeterminationEngine.js";
import {
  recalculatePermanentFrameworkSignals,
  readPermanentFrameworkSignals,
} from "../../services/PermanentFrameworkSignalService.js";
import {
  archetypeSignalWindowDays,
  emitArchetypeContextMissingIfNeeded,
  loadBlueprintArchetypeContext,
} from "../erector/ArchetypeExecutionContext.js";
import type { ExecutionLoopKind } from "../erector/ArchetypeExecutionContext.js";
import {
  buildSignalTierExtensions,
  loadBlueprintTierContext,
} from "../blueprint/tierEngineAwareness.js";

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

/** DOC B8 — confidence weight multipliers for quality-adjusted score. */
export const CONFIDENCE_WEIGHT_MULTIPLIERS = {
  high: 1.5,
  medium: 1.0,
  low: 0.5,
  gaming: 0.3,
} as const;

/** DOC B8 — feedback submitted more than 72 hours after task start. */
export const LATE_FEEDBACK_HOURS = 72;

export type FeedbackRow = typeof feedback.$inferSelect;

/** DOC B8 / chain alignment — legacy names map to canonical event types. */
export const SIGNAL_CHAIN_EVENTS = {
  signal_updated: EVENT_TYPES.SIGNAL_CALCULATED,
  condition_evaluation_requested: EVENT_TYPES.CONDITION_EVALUATION_REQUESTED,
} as const;

async function emitSignalCalculationChainEvents(params: {
  blueprintId: string;
  userId: string;
  snapshotId: string;
  assignedCondition: string;
  metrics: SignalMetrics;
  causationEventId?: string;
}): Promise<void> {
  const { blueprintId, userId, snapshotId, assignedCondition, metrics, causationEventId } = params;

  await writeEvent({
    eventType: SIGNAL_CHAIN_EVENTS.signal_updated,
    entityType: "signal_snapshot",
    entityId: snapshotId,
    userId,
    blueprintId,
    payload: {
      signal_snapshot_id: snapshotId,
      assigned_condition: assignedCondition,
      completion_rate: metrics.completion_rate,
      weighted_score: metrics.weighted_score,
      momentum: metrics.momentum,
      trend: metrics.trend,
      confidence: metrics.confidence,
      signal_updated: true,
    },
    idempotencyKey: `signal_updated:${blueprintId}:${snapshotId}`,
    causationEventId,
  });

  await writeEvent({
    eventType: SIGNAL_CHAIN_EVENTS.condition_evaluation_requested,
    entityType: "signal_snapshot",
    entityId: snapshotId,
    userId,
    blueprintId,
    payload: {
      signal_snapshot_id: snapshotId,
      assigned_condition: assignedCondition,
      condition_evaluation_requested: true,
    },
    idempotencyKey: `condition_evaluation_requested:${blueprintId}:${snapshotId}`,
    causationEventId,
  });
}

function trendMatches(trend: string, allowed: string[]): boolean {
  const normalized = trend === "flat" ? "stable" : trend;
  return allowed.includes(normalized);
}

/** DOC B8 Rule 1 / gaming tier — high score with short reflection. */
export function isHighScoreShortReflection(score: number, reflection: string | null | undefined): boolean {
  const ref = (reflection ?? "").trim();
  return score >= 9 && ref.length < 50;
}

/** DOC B8 Rule 5 — late submission penalty threshold. */
export function isLateFeedbackSubmission(
  feedbackCreatedAt: Date,
  taskStartedAt: Date | null | undefined,
  latePenaltyApplied?: boolean,
): boolean {
  if (latePenaltyApplied) return true;
  if (!taskStartedAt) return false;
  const hours =
    (new Date(feedbackCreatedAt).getTime() - new Date(taskStartedAt).getTime()) / 3600000;
  return hours > LATE_FEEDBACK_HOURS;
}

/** DOC B8 Rule 4 — evidence type mismatch (feedback should be rejected upstream). */
export function evidenceMatchesExpectedOutput(
  proofJson: Record<string, unknown> | null | undefined,
  expectedOutputType: string | null | undefined,
): boolean {
  if (!expectedOutputType || expectedOutputType === "none") return true;
  if (!proofJson || Object.keys(proofJson).length === 0) return false;
  const proofType = String(proofJson.type ?? proofJson.kind ?? proofJson.media_type ?? "").toLowerCase();
  const expected = expectedOutputType.toLowerCase();
  if (!proofType) return false;
  return proofType.includes(expected) || expected.includes(proofType);
}

/** DOC B8 Rule 2 — consistently high scores with no variation over 5+ tasks. */
export function detectSuspiciousHighScorePattern(rows: FeedbackRow[]): boolean {
  if (rows.length < 5) return false;
  const recent = rows.slice(-5);
  const scores = recent.map((r) => r.score ?? 0);
  if (!scores.every((s) => s >= 9)) return false;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
  return Math.sqrt(variance) < 0.01;
}

/** DOC B8 Rule 3 — score 10 across 5+ consecutive tasks with minimal reflection. */
export function detectConsecutivePerfectScoreGaming(rows: FeedbackRow[]): boolean {
  if (rows.length < 5) return false;
  const recent = rows.slice(-5);
  return recent.every(
    (r) =>
      (r.score ?? 0) === 10 &&
      (r.reflection ?? "").trim().length < 50,
  );
}

export type FeedbackConfidenceWeight = {
  multiplier: number;
  tier: keyof typeof CONFIDENCE_WEIGHT_MULTIPLIERS;
  gaming_flag: boolean;
  gaming_reason?: string;
  late_penalty_applied: boolean;
};

/** DOC B8 — per-feedback confidence weight for signal impact. */
export function resolveFeedbackConfidenceWeight(
  row: FeedbackRow,
  options?: { taskStartedAt?: Date | null; expectedOutputType?: string | null },
): FeedbackConfidenceWeight {
  const score = row.score ?? 0;
  const reflection = (row.reflection ?? "").trim();
  const late_penalty_applied = isLateFeedbackSubmission(
    row.created_at,
    options?.taskStartedAt,
    row.late_penalty_applied,
  );

  if (
    options?.expectedOutputType &&
    !evidenceMatchesExpectedOutput(
      row.proof_json as Record<string, unknown> | null,
      options.expectedOutputType,
    )
  ) {
    return {
      multiplier: CONFIDENCE_WEIGHT_MULTIPLIERS.low,
      tier: "low",
      gaming_flag: true,
      gaming_reason: "EVIDENCE_TYPE_MISMATCH",
      late_penalty_applied,
    };
  }

  if (row.gaming_flag || isHighScoreShortReflection(score, reflection)) {
    return {
      multiplier: CONFIDENCE_WEIGHT_MULTIPLIERS.gaming,
      tier: "gaming",
      gaming_flag: true,
      gaming_reason: row.gaming_reason ?? "HIGH_SCORE_WEAK_REFLECTION",
      late_penalty_applied,
    };
  }

  if (late_penalty_applied) {
    return {
      multiplier: CONFIDENCE_WEIGHT_MULTIPLIERS.low,
      tier: "low",
      gaming_flag: false,
      late_penalty_applied: true,
    };
  }

  const hasEvidence =
    row.proof_json != null &&
    typeof row.proof_json === "object" &&
    Object.keys(row.proof_json as object).length > 0;

  if (reflection.length >= 80 && hasEvidence && score >= 5) {
    return {
      multiplier: CONFIDENCE_WEIGHT_MULTIPLIERS.high,
      tier: "high",
      gaming_flag: false,
      late_penalty_applied: false,
    };
  }

  if (reflection.length < 30 || (score >= 8 && reflection.length < 50)) {
    return {
      multiplier: CONFIDENCE_WEIGHT_MULTIPLIERS.low,
      tier: "low",
      gaming_flag: false,
      late_penalty_applied: false,
    };
  }

  return {
    multiplier: CONFIDENCE_WEIGHT_MULTIPLIERS.medium,
    tier: "medium",
    gaming_flag: false,
    late_penalty_applied: false,
  };
}

/** DOC B8 — anti-gaming scan across a feedback window. */
export function detectAntiGamingSignals(rows: FeedbackRow[]): {
  gaming_flag: boolean;
  suspicious_pattern: boolean;
  consecutive_perfect_gaming: boolean;
  flagged_count: number;
} {
  const flagged = rows.filter(
    (r) =>
      r.gaming_flag ||
      isHighScoreShortReflection(r.score ?? 0, r.reflection),
  ).length;
  return {
    gaming_flag: flagged > 0,
    suspicious_pattern: detectSuspiciousHighScorePattern(rows),
    consecutive_perfect_gaming: detectConsecutivePerfectScoreGaming(rows),
    flagged_count: flagged,
  };
}

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
  /** primary = feedback path; daily = midnight/daily loop signal refresh */
  executionLoop?: ExecutionLoopKind;
  /** Phase 8 — e.g. `inactivity` from inactivity detection events */
  triggerReason?: string;
}): Promise<{
  snapshotId: string;
  condition: string;
  metrics: SignalMetrics;
  operationalMathematics: OperationalMathematicsDocument;
}> {
  const now = new Date();

  const bpArchetype = await loadBlueprintArchetypeContext(params.blueprintId);
  const tierCtx = await loadBlueprintTierContext(params.blueprintId);
  const loopKind = params.executionLoop ?? "primary";
  await emitArchetypeContextMissingIfNeeded({
    blueprintId: params.blueprintId,
    userId: params.userId,
    primaryArchetypeId: bpArchetype?.primaryArchetypeId,
    loop: loopKind === "daily" ? "daily" : "primary",
  });
  const timeMult = bpArchetype?.archetypeTimeframeMult ?? 1.0;
  const historyDays = tierCtx?.tierConfig.signal_history_days ?? archetypeSignalWindowDays(timeMult);
  const windowDays = Math.max(archetypeSignalWindowDays(timeMult), historyDays);
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  logger.info(
    {
      blueprint_id: params.blueprintId,
      timeMult,
      windowDays,
      executionLoop: loopKind,
    },
    "[DailyLoop] Archetype timeframe window applied",
  );

  const windowStart = new Date(now.getTime() - windowMs);
  const priorEnd = windowStart;
  const priorStart = new Date(priorEnd.getTime() - windowMs);
  const windowEnd = new Date();

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

  const structuredInWindow = await db
    .select()
    .from(activeFeedbackSessions)
    .where(
      and(
        eq(activeFeedbackSessions.blueprint_id, params.blueprintId),
        eq(activeFeedbackSessions.user_id, params.userId),
        gte(activeFeedbackSessions.created_at, windowStart),
        lte(activeFeedbackSessions.created_at, windowEnd),
        sql`${activeFeedbackSessions.completed_at} IS NOT NULL`,
      ),
    )
    .orderBy(activeFeedbackSessions.created_at);

  const priorStructured = await db
    .select()
    .from(activeFeedbackSessions)
    .where(
      and(
        eq(activeFeedbackSessions.blueprint_id, params.blueprintId),
        eq(activeFeedbackSessions.user_id, params.userId),
        gte(activeFeedbackSessions.created_at, priorStart),
        lte(activeFeedbackSessions.created_at, priorEnd),
        sql`${activeFeedbackSessions.completed_at} IS NOT NULL`,
      ),
    );

  const [orderList, targetList] = await Promise.all([
    db.select().from(orders).where(and(eq(orders.blueprint_id, params.blueprintId), eq(orders.user_id, params.userId))),
    db.select().from(targets).where(eq(targets.blueprint_id, params.blueprintId)),
  ]);

  let metrics = calculateMetrics(feedbackInWindow, priorFeedback);
  if (structuredInWindow.length > 0) {
    metrics = mergeStructuredFeedbackMetrics(metrics, structuredInWindow, priorStructured);
  }

  if (metrics.tasks_in_window === 0) {
    const ordersInWindow = orderList.filter((o) => {
      const anchor = o.started_at ?? o.created_at;
      return anchor && anchor >= windowStart && anchor <= windowEnd;
    });
    if (ordersInWindow.length > 0) {
      metrics = { ...metrics, tasks_in_window: ordersInWindow.length };
    }
  }
  if (metrics.completion_rate === 0 && feedbackInWindow.length > 0) {
    metrics = {
      ...metrics,
      completion_rate: calcCompletionRate(feedbackInWindow),
      weighted_score: calcWeightedScore(feedbackInWindow),
    };
  }

  const { applyInactivityMomentumPenalty } = await import("./signalInactivityMomentum.js");
  metrics = {
    ...metrics,
    momentum: await applyInactivityMomentumPenalty({
      blueprintId: params.blueprintId,
      momentum: metrics.momentum,
      triggerReason: params.triggerReason,
    }),
  };

  const [prevSnapshot] = await db
    .select()
    .from(signalSnapshots)
    .where(
      and(eq(signalSnapshots.blueprint_id, params.blueprintId), eq(signalSnapshots.is_current, true)),
    )
    .limit(1);

  const [bpRow] = await db
    .select({ current_domain: blueprints.current_domain })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const operationalMathematics = computeOperationalMathematics({
    blueprintId: params.blueprintId,
    userId: params.userId,
    windowStart,
    windowEnd,
    feedbackRows: feedbackInWindow,
    orders: orderList,
    targets: targetList,
    previousSnapshot: prevSnapshot ?? null,
    signalMetrics: {
      completion_rate: metrics.completion_rate,
      weighted_score: metrics.weighted_score,
      momentum: metrics.momentum,
      trend: metrics.trend,
      confidence: metrics.confidence,
      blocker_ratio: metrics.blocker_ratio,
      skip_ratio: metrics.skip_ratio,
    },
    blueprintDomain: bpRow?.current_domain ?? null,
  });

  const prevCondition = prevSnapshot?.assigned_condition ?? "nothingness";
  const latestStructured = structuredInWindow.at(-1);

  const frameworkBundle = await recalculatePermanentFrameworkSignals({
    blueprintId: params.blueprintId,
    userId: params.userId,
  }).catch(async () => readPermanentFrameworkSignals(params.blueprintId));

  const structuredSignals = frameworkBundle
    ? {
        production_signal: frameworkBundle.signals.Production.value,
        operations_signal: frameworkBundle.signals.Operations.value,
        growth_signal: frameworkBundle.signals.Growth.value,
        scale_signal: frameworkBundle.signals.Scale.value,
        momentum: frameworkBundle.signals.Production.momentum,
      }
    : (latestStructured?.engine_metrics as
        | {
            production_signal?: number;
            operations_signal?: number;
            growth_signal?: number;
            scale_signal?: number;
            momentum?: number;
          }
        | undefined) ?? null;

  const omWithFramework = {
    ...operationalMathematics,
    frameworkSignals: frameworkBundle ?? undefined,
  } as OperationalMathematicsDocument & { frameworkSignals?: unknown };

  const assignedCondition = assignCondition(metrics, prevCondition ?? "nothingness", {
    operationalMathematics: omWithFramework,
    structuredSignals,
    previousConditionChangedAt: prevSnapshot?.created_at ?? null,
    now,
  });

  const tierExtensionsAfterAssign =
    tierCtx ?
      buildSignalTierExtensions({
        signalMode: tierCtx.signalMode,
        assignedCondition,
        momentum: metrics.momentum,
        completionRate: metrics.completion_rate,
        trend: metrics.trend,
      })
    : {};

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
        execution_score: structuredInWindow.at(-1)?.execution_score ?? metrics.completion_rate,
        feedback_confidence: structuredInWindow.at(-1)?.confidence ?? null,
        operational_mathematics_json: {
          ...(omWithFramework as unknown as Record<string, unknown>),
          tierAware: tierExtensionsAfterAssign,
        },
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

  await emitSignalCalculationChainEvents({
    blueprintId: params.blueprintId,
    userId: params.userId,
    snapshotId,
    assignedCondition,
    metrics,
    causationEventId: params.causationEventId,
  });

  return { snapshotId, condition: assignedCondition, metrics, operationalMathematics };
}

// ── METRIC CALCULATIONS ───────────────────────────────────────────────────────

export function mergeStructuredFeedbackMetrics(
  base: SignalMetrics,
  sessions: (typeof activeFeedbackSessions.$inferSelect)[],
  priorSessions: (typeof activeFeedbackSessions.$inferSelect)[],
): SignalMetrics {
  const latest = sessions.at(-1);
  if (!latest?.engine_metrics) return base;

  const em = latest.engine_metrics as {
    completion_rate?: number;
    final_execution_score?: number;
    momentum?: number;
    confidence?: number;
  };

  const completion_rate = em.completion_rate ?? base.completion_rate;
  const weighted_score = (em.final_execution_score ?? base.completion_rate) * 10;
  const priorExec = priorSessions.at(-1)?.execution_score;
  const momentum =
    priorExec != null && latest.execution_score != null
      ? Math.round((latest.execution_score - priorExec) * 10)
      : base.momentum;

  return {
    ...base,
    completion_rate,
    weighted_score,
    raw_score: weighted_score,
    momentum,
    confidence:
      (em.confidence ?? 0.9) >= 0.85
        ? "high"
        : (em.confidence ?? 0.5) >= 0.7
          ? "medium"
          : "low",
    tasks_in_window: Math.max(base.tasks_in_window, sessions.length),
  };
}

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
  let weightedTotal = 0;
  let weightSum = 0;
  for (const row of rows) {
    const score = row.score ?? 0;
    if (row.weighted_score != null && !row.gaming_flag && !row.late_penalty_applied) {
      weightedTotal += Number(row.weighted_score);
      weightSum += 1;
      continue;
    }
    const { multiplier } = resolveFeedbackConfidenceWeight(row);
    weightedTotal += score * multiplier;
    weightSum += multiplier;
  }
  if (weightSum === 0) return 0;
  return weightedTotal / weightSum;
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
  if (count <= 2) return "low";

  const antiGaming = detectAntiGamingSignals(rows);
  if (antiGaming.consecutive_perfect_gaming || antiGaming.suspicious_pattern) {
    return "low";
  }

  const gamingCount = rows.filter((f) => f.gaming_flag || isHighScoreShortReflection(f.score ?? 0, f.reflection)).length;
  const gamingRatio = gamingCount / count;
  if (gamingRatio > 0.3) return "low";

  if (count <= 5) return gamingRatio > 0 ? "low" : "medium";
  return gamingRatio > 0.15 ? "medium" : "high";
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

// ── CONDITION ASSIGNMENT (DOC B8 matrix) ─────────────────────────────────────

/** Priority-ordered DOC B8 condition assignment — first matching rule wins. */
export function assignConditionFromB8Matrix(metrics: SignalMetrics): string {
  const cr = metrics.completion_rate;
  const ws = metrics.weighted_score;
  const { momentum, trend, confidence, tasks_in_window: tasks } = metrics;

  if (confidence === "insufficient_data" || tasks < 3) {
    return "nothingness";
  }
  if (cr <= 0.1 && ws <= 2.0) {
    return "nothingness";
  }

  if (cr <= 0.3 && ws <= 4.0 && (trend === "declining" || momentum === 0)) {
    return "danger";
  }

  if (
    cr >= 0.3 &&
    cr < 0.5 &&
    ws >= 4.0 &&
    ws <= 5.5 &&
    trendMatches(trend, ["flat", "declining", "stable"])
  ) {
    return "urgency";
  }

  if (
    cr >= 0.5 &&
    cr < 0.7 &&
    ws >= 5.5 &&
    ws <= 7.0 &&
    trendMatches(trend, ["stable", "recovering"])
  ) {
    return "stability";
  }

  if (
    cr >= 0.7 &&
    cr <= 0.85 &&
    ws >= 7.0 &&
    ws <= 8.5 &&
    trendMatches(trend, ["stable", "rising"]) &&
    momentum >= 3
  ) {
    return "power";
  }

  if (cr > 0.85 && ws > 8.5 && trend === "rising" && momentum >= 7) {
    return "affluence";
  }

  if (cr < 0.3) return "danger";
  if (cr < 0.5) return "urgency";
  if (cr < 0.7) return "stability";
  if (cr <= 0.85) return "power";
  return "affluence";
}

export function assignCondition(
  metrics: SignalMetrics,
  previousCondition: string,
  options?: {
    operationalMathematics?: OperationalMathematicsDocument;
    structuredSignals?: {
      production_signal?: number;
      operations_signal?: number;
      growth_signal?: number;
      scale_signal?: number;
      momentum?: number;
    } | null;
    /** When the previous condition was assigned — for 24h power_change gate. */
    previousConditionChangedAt?: Date | null;
    now?: Date;
  },
): string {
  if (options?.structuredSignals?.production_signal != null) {
    return assignConditionFromMetrics(metrics, previousCondition, options);
  }

  const proposed = assignConditionFromB8Matrix(metrics);
  const now = options?.now ?? new Date();
  const within24h =
    !options?.previousConditionChangedAt ||
    now.getTime() - options.previousConditionChangedAt.getTime() <= 24 * 60 * 60 * 1000;

  if (
    within24h &&
    proposed !== "nothingness" &&
    metrics.confidence !== "insufficient_data" &&
    metrics.tasks_in_window >= 3 &&
    isPowerChange(proposed, previousCondition)
  ) {
    return "power_change";
  }

  return proposed;
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
