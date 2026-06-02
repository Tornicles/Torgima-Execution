import {
  db,
  feedback,
  orders,
  behaviorPatterns,
  behaviorEvents,
  capabilityProfiles,
  inactivityRecords,
  blueprints,
} from "@workspace/db";
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { BlueprintStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { getOpenFlags } from "../outcome/OutcomeValidationEngine.js";
import {
  calculatePatternScores,
  computeSpecFatigueRiskScore,
  consecutiveCompletedDays,
} from "./patternScoring.js";
import { emitPatternResponseEvent } from "./patternResponseEvents.js";

/** DOC_21 — full pattern spec labels (stored in evidence_json.spec_label). */
export const PATTERN_SPEC_LABELS = [
  "CONSISTENT_EXECUTION",
  "DELAY_PATTERN",
  "DIFFICULTY_FAILURE",
  "TASK_TYPE_AVOIDANCE",
  "LOW_VALUE_COMPLETION",
  "RECOVERY_SUCCESS",
  "ABANDONMENT_RISK",
  "FATIGUE_RISK",
  "VOLATILE_EXECUTION",
  "DIFFICULTY_CEILING",
  "RECOVERY_DEPENDENCE",
  "FALSE_PROGRESS_PATTERN",
  "FOCUS_DRIFT",
  "BURNOUT_RISK",
] as const;

export type PatternSpecLabel = (typeof PATTERN_SPEC_LABELS)[number];

/** IL3 LAW 3 — minimum occurrences within the evidence window. */
export const PATTERN_MIN_OCCURRENCES = 3;

export const DOC21_PATTERN_TYPES = [
  "procrastination",
  "inconsistency",
  "avoidance",
  "fake_completion",
  "difficulty_ceiling",
  "task_type_avoidance",
  "burnout",
  "recovery_dependence",
  "false_progress",
  "focus_drift",
] as const;

type DbPatternType =
  | "procrastination"
  | "burnout"
  | "inconsistency"
  | "avoidance"
  | "fake_completion"
  | "low_reflection"
  | "blocker_repetition"
  | "inactivity"
  | "score_inflation"
  | "difficulty_ceiling"
  | "task_type_avoidance"
  | "recovery_dependence"
  | "false_progress"
  | "focus_drift";

function mapSpecLabelToDbType(label: PatternSpecLabel): DbPatternType {
  const m: Record<PatternSpecLabel, DbPatternType> = {
    CONSISTENT_EXECUTION: "score_inflation",
    DELAY_PATTERN: "procrastination",
    DIFFICULTY_FAILURE: "blocker_repetition",
    TASK_TYPE_AVOIDANCE: "task_type_avoidance",
    LOW_VALUE_COMPLETION: "fake_completion",
    RECOVERY_SUCCESS: "inconsistency",
    ABANDONMENT_RISK: "inactivity",
    FATIGUE_RISK: "burnout",
    VOLATILE_EXECUTION: "inconsistency",
    DIFFICULTY_CEILING: "difficulty_ceiling",
    RECOVERY_DEPENDENCE: "recovery_dependence",
    FALSE_PROGRESS_PATTERN: "false_progress",
    FOCUS_DRIFT: "focus_drift",
    BURNOUT_RISK: "burnout",
  };
  return m[label];
}

const FATIGUE_RISK_SCORE: Record<string, number> = {
  low: 0.2,
  moderate: 0.5,
  high: 0.75,
  critical: 0.9,
};

export function meetsPatternThreshold(count: number, min = PATTERN_MIN_OCCURRENCES): boolean {
  return count >= min;
}

/** IL3 — burnout signal count from execution window (read-only intelligence). */
export function countBurnoutSignals(input: {
  failureRate: number;
  inactivityCount: number;
  lateCount: number;
  fatigueRiskScore: number;
}): number {
  return [
    input.failureRate >= 0.5,
    input.inactivityCount >= 3,
    input.lateCount >= 4,
    input.fatigueRiskScore >= 0.7,
  ].filter(Boolean).length;
}

export async function scanPatterns(params: {
  userId: string;
  blueprintId: string;
  windowDays?: number;
}): Promise<{ patternsDetected: number; fatigueRisk: string; burnoutRisk: boolean }> {
  const window = params.windowDays ?? 14;
  const since = new Date(Date.now() - window * 86400000);

  const feedbackRows = await db
    .select({
      id: feedback.id,
      created_at: feedback.created_at,
      completion_status: feedback.completion_status,
      score: feedback.score,
      friction_score: feedback.friction_score,
      confidence_score: feedback.confidence_score,
      order_id: feedback.order_id,
      late_penalty_applied: feedback.late_penalty_applied,
      gaming_flag: feedback.gaming_flag,
      reflection: feedback.reflection,
      taskDifficulty: orders.difficulty,
      taskType: orders.task_type,
    })
    .from(feedback)
    .innerJoin(orders, eq(feedback.order_id, orders.id))
    .where(
      and(
        eq(feedback.user_id, params.userId),
        eq(feedback.blueprint_id, params.blueprintId),
        gte(feedback.created_at, since),
      ),
    )
    .orderBy(asc(feedback.created_at));

  const orderRows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.user_id, params.userId),
        eq(orders.blueprint_id, params.blueprintId),
        gte(orders.created_at, since),
      ),
    )
    .orderBy(asc(orders.created_at));

  const patterns: PatternSpecLabel[] = [];

  const consistentCount = feedbackRows.filter(
    (f) => f.completion_status === "completed" && (f.score ?? 0) >= 7,
  ).length;
  if (meetsPatternThreshold(consistentCount)) patterns.push("CONSISTENT_EXECUTION");

  const delayCount = orderRows.filter((o) => {
    if (!o.started_at) return false;
    const startDelay = (o.started_at.getTime() - o.created_at.getTime()) / 3600000;
    return startDelay > 24;
  }).length;
  if (meetsPatternThreshold(delayCount)) patterns.push("DELAY_PATTERN");

  const lateCount = feedbackRows.filter((f) => f.late_penalty_applied).length;

  const difficultyFailures = feedbackRows.filter(
    (f) =>
      f.completion_status === "failed" &&
      ["hard", "very_hard"].includes((f.taskDifficulty as string) ?? ""),
  ).length;
  if (meetsPatternThreshold(difficultyFailures)) patterns.push("DIFFICULTY_FAILURE");

  const sameDifficultyFails = feedbackRows.filter(
    (f) => f.completion_status === "failed" && f.taskDifficulty === "hard",
  ).length;
  if (meetsPatternThreshold(sameDifficultyFails)) patterns.push("DIFFICULTY_CEILING");

  const lowValue = feedbackRows.filter(
    (f) => f.completion_status === "completed" && (f.score ?? 0) < 5,
  ).length;
  if (meetsPatternThreshold(lowValue)) patterns.push("LOW_VALUE_COMPLETION");

  const avoidance = feedbackRows.filter(
    (f) =>
      f.taskType === "execution" &&
      (f.completion_status === "skipped" || f.completion_status === "failed"),
  ).length;
  if (meetsPatternThreshold(avoidance)) patterns.push("TASK_TYPE_AVOIDANCE");

  const recoveryOrders = orderRows.filter((o) => o.task_type === "recovery").length;
  const executionOrders = orderRows.filter((o) => o.task_type === "execution").length;
  if (
    meetsPatternThreshold(recoveryOrders) &&
    executionOrders < Math.max(1, Math.floor(recoveryOrders / 2))
  ) {
    patterns.push("RECOVERY_DEPENDENCE");
  }

  const openFalseProgress = await getOpenFlags(params.blueprintId);
  if (openFalseProgress.length > 0) patterns.push("FALSE_PROGRESS_PATTERN");

  const driftHints = feedbackRows.filter((f) => {
    const r = (f.reflection ?? "").toLowerCase();
    return (
      f.completion_status === "completed" &&
      (r.includes("off track") || r.includes("wrong goal") || r.includes("not aligned"))
    );
  }).length;
  if (meetsPatternThreshold(driftHints)) patterns.push("FOCUS_DRIFT");

  if (feedbackRows.length >= 6) {
    const mid = Math.floor(feedbackRows.length / 2);
    const firstHalf = feedbackRows.slice(0, mid);
    const secondHalf = feedbackRows.slice(mid);
    const rateFirst =
      firstHalf.filter((f) => f.completion_status === "completed").length /
      Math.max(1, firstHalf.length);
    const rateSecond =
      secondHalf.filter((f) => f.completion_status === "completed").length /
      Math.max(1, secondHalf.length);
    if (Math.abs(rateFirst - rateSecond) >= 0.3) patterns.push("VOLATILE_EXECUTION");
  }

  const last3Days = new Date(Date.now() - 3 * 86400000);
  const recentActivity = feedbackRows.filter((f) => f.created_at >= last3Days).length;
  const priorActivity = feedbackRows.filter((f) => f.created_at < last3Days).length;
  if (recentActivity === 0 && priorActivity >= PATTERN_MIN_OCCURRENCES) {
    patterns.push("ABANDONMENT_RISK");
  }

  if (feedbackRows.length >= 5) {
    const hadFail = feedbackRows.some((f) => f.completion_status === "failed");
    const tail = feedbackRows.slice(-3);
    const recovered =
      hadFail &&
      tail.every((f) => f.completion_status === "completed" && (f.score ?? 0) >= 7);
    if (recovered) patterns.push("RECOVERY_SUCCESS");
  }

  const avgFriction =
    feedbackRows.length > 0
      ? feedbackRows.reduce((s, f) => s + (f.friction_score ?? 0), 0) / feedbackRows.length
      : 0;
  const failureRate =
    feedbackRows.length > 0
      ? feedbackRows.filter((f) => f.completion_status === "failed").length / feedbackRows.length
      : 0;
  const avgConfidence =
    feedbackRows.length > 0
      ? feedbackRows.reduce((s, f) => s + (f.confidence_score ?? 5), 0) /
        feedbackRows.length /
        5
      : 1;
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
  const prev7 = feedbackRows.filter((f) => f.created_at >= sevenDaysAgo);
  const curr3 = feedbackRows.filter((f) => f.created_at >= threeDaysAgo);
  const prev7Rate =
    prev7.length > 0
      ? prev7.filter((f) => f.completion_status === "completed").length / prev7.length
      : 0;
  const curr3Rate =
    curr3.length > 0
      ? curr3.filter((f) => f.completion_status === "completed").length / curr3.length
      : 0;

  const hardLast3d = feedbackRows.filter(
    (f) =>
      f.created_at >= threeDaysAgo &&
      ["hard", "very_hard"].includes((f.taskDifficulty as string) ?? "") &&
      f.completion_status === "completed",
  ).length;

  const [{ openInactivity = 0 } = {}] = await db
    .select({ openInactivity: count() })
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.user_id, params.userId),
        eq(inactivityRecords.blueprint_id, params.blueprintId),
        eq(inactivityRecords.resolved, false),
      ),
    );

  const specRiskScore = computeSpecFatigueRiskScore({
    prev7dCompletionRate: prev7Rate,
    curr3dCompletionRate: curr3Rate,
    recentTasks: feedbackRows.slice(-10).map((f) => ({
      effortScore: f.confidence_score,
      notesLength: (f.reflection ?? "").length,
      durationMinutes: null,
      timeEstimate: 30,
    })),
    hardTasksLast3d: hardLast3d,
    inactivityAfterIntensity: Number(openInactivity) > 0,
  });

  const fatigueScore =
    (avgFriction / 5) * 0.4 + failureRate * 0.4 + (1 - avgConfidence) * 0.2;
  const fatigueRisk =
    specRiskScore >= 0.6
      ? "CRITICAL"
      : specRiskScore >= 0.45
        ? "HIGH"
        : fatigueScore >= 0.7
          ? "CRITICAL"
          : fatigueScore >= 0.5
            ? "HIGH"
            : fatigueScore >= 0.3
              ? "MEDIUM"
              : "LOW";

  if (specRiskScore >= 0.6 || ["HIGH", "CRITICAL"].includes(fatigueRisk)) {
    patterns.push("FATIGUE_RISK");
  }

  const dayBuckets = new Map<string, { completed: number; total: number }>();
  for (const f of feedbackRows) {
    const day = f.created_at.toISOString().slice(0, 10);
    const b = dayBuckets.get(day) ?? { completed: 0, total: 0 };
    b.total++;
    if (f.completion_status === "completed") b.completed++;
    dayBuckets.set(day, b);
  }
  if (consecutiveCompletedDays(dayBuckets) >= 7) {
    patterns.push("CONSISTENT_EXECUTION");
  }

  const [{ inactivityCount = 0 } = {}] = await db
    .select({ inactivityCount: count() })
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.user_id, params.userId),
        eq(inactivityRecords.blueprint_id, params.blueprintId),
        gte(inactivityRecords.created_at, since),
      ),
    );

  const [capability] = await db
    .select({ fatigue_risk: capabilityProfiles.fatigue_risk })
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  const fatigueRiskScore = FATIGUE_RISK_SCORE[capability?.fatigue_risk ?? "low"] ?? 0.2;
  const burnoutSignalCount = countBurnoutSignals({
    failureRate,
    inactivityCount: Number(inactivityCount),
    lateCount,
    fatigueRiskScore,
  });

  let burnoutRisk = false;
  if (burnoutSignalCount >= 3) {
    burnoutRisk = true;
    if (!patterns.includes("BURNOUT_RISK")) patterns.push("BURNOUT_RISK");
  }

  const uniquePatterns = [...new Set(patterns)];
  let patternsDetected = 0;

  for (const patternType of uniquePatterns) {
    const dbType = mapSpecLabelToDbType(patternType);

    const specFilter = sql`(${behaviorPatterns.evidence_json})::jsonb->>'spec_label' = ${patternType}`;

    const [existing] = await db
      .select()
      .from(behaviorPatterns)
      .where(
        and(
          eq(behaviorPatterns.user_id, params.userId),
          eq(behaviorPatterns.blueprint_id, params.blueprintId),
          eq(behaviorPatterns.pattern_type, dbType),
          eq(behaviorPatterns.status, "active"),
          specFilter,
        ),
      )
      .limit(1);

    const sevRaw =
      patternType === "FATIGUE_RISK" || patternType === "BURNOUT_RISK"
        ? fatigueRisk.toLowerCase()
        : "moderate";
    const evidence = {
      spec_label: patternType,
      window_days: window,
      fatigue_risk_band: fatigueRisk,
      burnout_signals: burnoutSignalCount,
    };

    if (!existing) {
      const [created] = await db
        .insert(behaviorPatterns)
        .values({
          user_id: params.userId,
          blueprint_id: params.blueprintId,
          pattern_type: dbType,
          severity: sevRaw,
          confidence: feedbackRows.length >= 7 ? 0.8 : 0.6,
          frequency: feedbackRows.length || 1,
          status: "active",
          evidence_json: evidence,
          first_detected_at: new Date(),
          last_detected_at: new Date(),
        })
        .returning({ id: behaviorPatterns.id });

      patternsDetected++;

      if (created) {
        const scores = calculatePatternScores({
          occurrenceCount: feedbackRows.length,
          windowSize: Math.max(7, window),
          impactOnCompletion: failureRate,
          trendDelta: prev7Rate - curr3Rate,
          crossTypeStability: 0.7,
        });
        await db.insert(behaviorEvents).values({
          user_id: params.userId,
          blueprint_id: params.blueprintId,
          pattern_id: created.id,
          event_type: "pattern_detected",
          data_json: {
            spec_label: patternType,
            fatigue_risk: fatigueRisk,
            scores,
            spec_risk_score: specRiskScore,
          },
        });
        await emitPatternResponseEvent({
          pattern: patternType,
          userId: params.userId,
          blueprintId: params.blueprintId,
          patternId: created.id,
          riskScore: specRiskScore,
        });
      }
    } else {
      await db
        .update(behaviorPatterns)
        .set({
          last_detected_at: new Date(),
          frequency: existing.frequency + 1,
          evidence_json: evidence,
        })
        .where(eq(behaviorPatterns.id, existing.id));
    }
  }

  if (burnoutRisk) {
    await writeEvent({
      eventType: EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED,
      entityType: "user",
      entityId: params.userId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: {
        reason: "burnout_risk",
        action: "reduce_difficulty",
        reduce_task_count: true,
      },
      idempotencyKey: `burnout_adapt:${params.userId}:${Math.floor(Date.now() / 86400000)}`,
    });
  }

  if (["HIGH", "CRITICAL"].includes(fatigueRisk)) {
    await writeEvent({
      eventType: EVENT_TYPES.BURNOUT_RISK_DETECTED,
      entityType: "blueprint",
      entityId: params.blueprintId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: { risk_level: fatigueRisk, recommended_response: "reduce_load" },
      idempotencyKey: `burnout:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
    });
  }

  const resolved = await resolveEligiblePatterns(params.userId, params.blueprintId, {
    specRiskScore,
    dayBuckets,
  });

  logger.info(
    {
      blueprintId: params.blueprintId,
      patterns: patterns.join(", "),
      fatigueRisk,
      burnoutRisk,
      detected: patternsDetected,
      resolved,
      specRiskScore,
    },
    "[PatternEngine] Scan complete",
  );

  return { patternsDetected, fatigueRisk, burnoutRisk };
}

async function resolveEligiblePatterns(
  userId: string,
  blueprintId: string,
  ctx: {
    specRiskScore: number;
    dayBuckets: Map<string, { completed: number; total: number }>;
  },
): Promise<number> {
  const active = await getActivePatterns(userId, blueprintId);
  let resolved = 0;

  for (const p of active) {
    const evidence =
      p.evidence_json && typeof p.evidence_json === "object" && !Array.isArray(p.evidence_json)
        ? (p.evidence_json as Record<string, unknown>)
        : {};
    const spec = String(evidence.spec_label ?? "");

    let shouldResolve = false;
    if (spec === "RECOVERY_SUCCESS") {
      const abandonment = active.find(
        (a) =>
          (a.evidence_json as Record<string, unknown> | undefined)?.spec_label ===
          "ABANDONMENT_RISK",
      );
      if (abandonment) {
        await resolvePattern(abandonment.id, "recovery_success");
        resolved++;
      }
    }
    if (spec === "FATIGUE_RISK" && ctx.specRiskScore < 0.4) shouldResolve = true;
    if (spec === "CONSISTENT_EXECUTION" && consecutiveCompletedDays(ctx.dayBuckets) < 5) {
      shouldResolve = false;
    }
    if (spec === "VOLATILE_EXECUTION" && ctx.dayBuckets.size >= 5) {
      const rates: number[] = [];
      const days = [...ctx.dayBuckets.keys()].sort().slice(-5);
      for (const d of days) {
        const b = ctx.dayBuckets.get(d)!;
        rates.push(b.completed / Math.max(1, b.total));
      }
      if (rates.length >= 5) {
        const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
        const variance =
          rates.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, rates.length);
        if (variance < 0.04) shouldResolve = true;
      }
    }

    if (shouldResolve) {
      await resolvePattern(p.id, "resolution_condition_met");
      resolved++;
    }
  }

  return resolved;
}

/** Phase 4 — scan all active blueprints (daily cron). */
export async function scanAll(): Promise<{ scanned: number; patternsDetected: number }> {
  const rows = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, BlueprintStatus.ACTIVE)));

  let patternsDetected = 0;
  for (const bp of rows) {
    const result = await scanPatterns({
      userId: bp.user_id,
      blueprintId: bp.id,
      windowDays: 14,
    });
    patternsDetected += result.patternsDetected;
  }

  logger.info({ scanned: rows.length, patternsDetected }, "[PatternEngine] scanAll complete");
  return { scanned: rows.length, patternsDetected };
}

export class PatternLearningEngine {
  scanForUser(userId: string, blueprintId: string, windowDays = 14) {
    return scanPatterns({ userId, blueprintId, windowDays });
  }

  scanAll() {
    return scanAll();
  }
}

export async function resolvePattern(patternId: string, _reason?: string): Promise<void> {
  void _reason;
  await db
    .update(behaviorPatterns)
    .set({ status: "resolved", resolved_at: new Date() })
    .where(eq(behaviorPatterns.id, patternId));
}

export async function getActivePatterns(
  userId: string,
  blueprintId: string,
): Promise<(typeof behaviorPatterns.$inferSelect)[]> {
  return db
    .select()
    .from(behaviorPatterns)
    .where(
      and(
        eq(behaviorPatterns.user_id, userId),
        eq(behaviorPatterns.blueprint_id, blueprintId),
        eq(behaviorPatterns.status, "active"),
      ),
    )
    .orderBy(desc(behaviorPatterns.last_detected_at));
}
