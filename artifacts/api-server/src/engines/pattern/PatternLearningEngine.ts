import {
  db,
  feedback,
  orders,
  behaviorPatterns,
  behaviorEvents,
} from "@workspace/db";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

/** Spec / doc labels from Prompt 10 — stored in evidence_json.spec_label. */
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
] as const;

export type PatternSpecLabel = (typeof PATTERN_SPEC_LABELS)[number];

type DbPatternType =
  | "procrastination"
  | "burnout"
  | "inconsistency"
  | "avoidance"
  | "fake_completion"
  | "low_reflection"
  | "blocker_repetition"
  | "inactivity"
  | "score_inflation";

function mapSpecLabelToDbType(label: PatternSpecLabel): DbPatternType {
  const m: Record<PatternSpecLabel, DbPatternType> = {
    CONSISTENT_EXECUTION:  "score_inflation",
    DELAY_PATTERN:         "procrastination",
    DIFFICULTY_FAILURE:    "blocker_repetition",
    TASK_TYPE_AVOIDANCE:   "avoidance",
    LOW_VALUE_COMPLETION:  "fake_completion",
    RECOVERY_SUCCESS:      "inconsistency",
    ABANDONMENT_RISK:      "inactivity",
    FATIGUE_RISK:          "burnout",
    VOLATILE_EXECUTION:    "inconsistency",
  };
  return m[label];
}

export async function scanPatterns(params: {
  userId:      string;
  blueprintId: string;
  windowDays?: number;
}): Promise<{ patternsDetected: number; fatigueRisk: string }> {
  const window = params.windowDays ?? 7;
  const since  = new Date(Date.now() - window * 86400000);

  const feedbackRows = await db
    .select({
      id: feedback.id,
      created_at: feedback.created_at,
      completion_status: feedback.completion_status,
      score: feedback.score,
      friction_score: feedback.friction_score,
      confidence_score: feedback.confidence_score,
      order_id: feedback.order_id,
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
    f => f.completion_status === "completed" && (f.score ?? 0) >= 7,
  ).length;
  if (consistentCount >= 5) patterns.push("CONSISTENT_EXECUTION");

  const delayCount = orderRows.filter(o => {
    if (!o.started_at) return false;
    const startDelay = (o.started_at.getTime() - o.created_at.getTime()) / 3600000;
    return startDelay > 24;
  }).length;
  if (delayCount >= 3) patterns.push("DELAY_PATTERN");

  const difficultyFailures = feedbackRows.filter(
    f =>
      f.completion_status === "failed" &&
      ["hard", "very_hard"].includes((f.taskDifficulty as string) ?? ""),
  ).length;
  if (difficultyFailures >= 3) patterns.push("DIFFICULTY_FAILURE");

  const lowValue = feedbackRows.filter(
    f => f.completion_status === "completed" && (f.score ?? 0) < 5,
  ).length;
  if (lowValue >= 4) patterns.push("LOW_VALUE_COMPLETION");

  const avoidance = feedbackRows.filter(
    f =>
      f.taskType === "execution" &&
      (f.completion_status === "skipped" || f.completion_status === "failed"),
  ).length;
  if (avoidance >= 4) patterns.push("TASK_TYPE_AVOIDANCE");

  if (feedbackRows.length >= 6) {
    const mid = Math.floor(feedbackRows.length / 2);
    const firstHalf  = feedbackRows.slice(0, mid);
    const secondHalf = feedbackRows.slice(mid);
    const rateFirst =
      firstHalf.filter(f => f.completion_status === "completed").length /
      Math.max(1, firstHalf.length);
    const rateSecond =
      secondHalf.filter(f => f.completion_status === "completed").length /
      Math.max(1, secondHalf.length);
    if (Math.abs(rateFirst - rateSecond) >= 0.3) patterns.push("VOLATILE_EXECUTION");
  }

  const last3Days = new Date(Date.now() - 3 * 86400000);
  const recentActivity = feedbackRows.filter(f => f.created_at >= last3Days).length;
  const priorActivity  = feedbackRows.filter(f => f.created_at < last3Days).length;
  if (recentActivity === 0 && priorActivity >= 3) patterns.push("ABANDONMENT_RISK");

  if (feedbackRows.length >= 5) {
    const hadFail = feedbackRows.some(f => f.completion_status === "failed");
    const tail = feedbackRows.slice(-3);
    const recovered =
      hadFail &&
      tail.every(f => f.completion_status === "completed" && (f.score ?? 0) >= 7);
    if (recovered) patterns.push("RECOVERY_SUCCESS");
  }

  const avgFriction =
    feedbackRows.length > 0
      ? feedbackRows.reduce((s, f) => s + (f.friction_score ?? 0), 0) / feedbackRows.length
      : 0;
  const failureRate =
    feedbackRows.length > 0
      ? feedbackRows.filter(f => f.completion_status === "failed").length / feedbackRows.length
      : 0;
  const avgConfidence =
    feedbackRows.length > 0
      ? feedbackRows.reduce((s, f) => s + (f.confidence_score ?? 5), 0) /
        feedbackRows.length /
        5
      : 1;
  const fatigueScore =
    (avgFriction / 5) * 0.4 + failureRate * 0.4 + (1 - avgConfidence) * 0.2;
  const fatigueRisk =
    fatigueScore >= 0.7
      ? "CRITICAL"
      : fatigueScore >= 0.5
        ? "HIGH"
        : fatigueScore >= 0.3
          ? "MEDIUM"
          : "LOW";

  if (["HIGH", "CRITICAL"].includes(fatigueRisk)) patterns.push("FATIGUE_RISK");

  let patternsDetected = 0;

  for (const patternType of patterns) {
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

    const sevRaw = patternType === "FATIGUE_RISK" ? fatigueRisk.toLowerCase() : "moderate";
    const evidence = {
      spec_label: patternType,
      window_days: window,
      fatigue_risk_band: fatigueRisk,
    };

    if (!existing) {
      const [created] = await db
        .insert(behaviorPatterns)
        .values({
          user_id:           params.userId,
          blueprint_id:      params.blueprintId,
          pattern_type:      dbType,
          severity:          sevRaw,
          confidence:        feedbackRows.length >= 7 ? 0.8 : 0.6,
          frequency:         feedbackRows.length || 1,
          status:            "active",
          evidence_json:     evidence,
          first_detected_at: new Date(),
          last_detected_at:  new Date(),
        })
        .returning({ id: behaviorPatterns.id });

      patternsDetected++;

      if (created) {
        await db.insert(behaviorEvents).values({
          user_id:      params.userId,
          blueprint_id: params.blueprintId,
          pattern_id:   created.id,
          event_type:   "pattern_detected",
          data_json:    { spec_label: patternType, fatigue_risk: fatigueRisk },
        });
      }
    } else {
      await db
        .update(behaviorPatterns)
        .set({
          last_detected_at: new Date(),
          frequency:        existing.frequency + 1,
          evidence_json:    evidence,
        })
        .where(eq(behaviorPatterns.id, existing.id));
    }
  }

  if (["HIGH", "CRITICAL"].includes(fatigueRisk)) {
    await writeEvent({
      eventType:      EVENT_TYPES.BURNOUT_RISK_DETECTED,
      entityType:     "blueprint",
      entityId:       params.blueprintId,
      userId:         params.userId,
      blueprintId:    params.blueprintId,
      payload:        { risk_level: fatigueRisk, recommended_response: "reduce_load" },
      idempotencyKey: `burnout:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
    }).catch(() => null);
  }

  logger.info(
    {
      blueprintId: params.blueprintId,
      patterns:    patterns.join(", "),
      fatigueRisk,
      detected:    patternsDetected,
    },
    "[PatternEngine] Scan complete",
  );

  return { patternsDetected, fatigueRisk };
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
