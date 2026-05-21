import {
  db,
  capabilityProfiles,
  capabilityHistory,
  feedback,
  orders,
} from "@workspace/db";
import { and, desc, eq, gte, sql, type InferSelectModel } from "drizzle-orm";
import {
  DIFFICULTY_ORDER,
  deriveDifficultyRecommendation,
  deriveOverallLevel,
  overallLevelToDbLevel,
} from "./CapabilityDifficulty.js";
import { EVENT_TYPES } from "../../services/EventService.js";

export type FeedbackRow = InferSelectModel<typeof feedback>;

const LEVEL_THRESHOLDS = {
  beginner: { minConsistency: 0, minQuality: 0, minTasks: 0 },
  operator: { minConsistency: 0.5, minQuality: 0.5, minTasks: 10 },
  advanced: { minConsistency: 0.7, minQuality: 0.7, minTasks: 30 },
  lead: { minConsistency: 0.85, minQuality: 0.85, minTasks: 75 },
};

type Throughput =
  "very_low" | "low" | "moderate" | "high" | "very_high";
type FatigueRisk = "low" | "moderate" | "high" | "critical";

export class CapabilityEngine {
  /**
   * GAP G6 LAW 1 — update capability profile after every feedback submission.
   */
  async updateAfterFeedback(userId: string, feedbackRow: FeedbackRow): Promise<void> {
    let [profile] = await db
      .select()
      .from(capabilityProfiles)
      .where(eq(capabilityProfiles.user_id, userId))
      .limit(1);

    if (!profile) {
      await db.insert(capabilityProfiles).values({
        user_id: userId,
        blueprint_id: feedbackRow.blueprint_id,
        level: "beginner",
        current_level: "developing",
        consistency_score: 0.5,
        execution_quality: 0.5,
        current_difficulty: "easy",
      });
      [profile] = await db
        .select()
        .from(capabilityProfiles)
        .where(eq(capabilityProfiles.user_id, userId))
        .limit(1);
    }

    if (!profile) return;

    const recentFeedback = await db
      .select({ ws: feedback.weighted_score, score: feedback.score })
      .from(feedback)
      .where(eq(feedback.user_id, userId))
      .orderBy(desc(feedback.created_at))
      .limit(10);

    const avgScore =
      recentFeedback.reduce((s, r) => s + (r.ws ?? r.score ?? 0), 0) /
      (recentFeedback.length || 1);
    const executionQuality = Math.min(1, avgScore / 10);

    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    const recentAll = await db
      .select({ c: feedback.completion_status })
      .from(feedback)
      .where(and(eq(feedback.user_id, userId), gte(feedback.created_at, twoWeeksAgo)));

    const completed = recentAll.filter(
      (r) => r.c === "completed" || r.c === "partial",
    ).length;
    const consistency =
      recentAll.length > 0 ? completed / recentAll.length : profile.consistency_score;

    const difficultyRec = deriveDifficultyRecommendation(executionQuality, consistency);
    const overall = deriveOverallLevel(executionQuality, consistency);
    const dbLevel = overallLevelToDbLevel(overall);

    const isCompleted = feedbackRow.completion_status === "completed";
    const nextCompleted = profile.tasks_completed + (isCompleted ? 1 : 0);
    const nextFailed =
      profile.tasks_failed + (feedbackRow.completion_status === "failed" ? 1 : 0);
    const nextStreak = isCompleted ? profile.streak_current + 1 : 0;
    const nextBest =
      isCompleted && nextStreak > profile.streak_best ? nextStreak : profile.streak_best;

    const throughput: Throughput =
      consistency >= 0.85
        ? "very_high"
        : consistency >= 0.7
          ? "high"
          : consistency >= 0.5
            ? "moderate"
            : consistency >= 0.3
              ? "low"
              : "very_low";

    const failureRate =
      recentAll.length > 0
        ? recentAll.filter((r) => r.c === "failed").length / recentAll.length
        : 0;
    const fatigueScore = failureRate * 0.6;
    const fatigueRisk: FatigueRisk =
      fatigueScore >= 0.5 ? "high" : fatigueScore >= 0.3 ? "moderate" : "low";

    const tasksPerDay = nextCompleted / Math.max(1, 14);
    const recoveryRate =
      feedbackRow.completion_status === "failed"
        ? Math.max(0, profile.recovery_rate * 0.85)
        : Math.min(1, profile.recovery_rate * 0.9 + 0.1);

    await db
      .update(capabilityProfiles)
      .set({
        blueprint_id: feedbackRow.blueprint_id ?? profile.blueprint_id,
        execution_quality: executionQuality,
        consistency_score: consistency,
        current_difficulty: difficultyRec,
        level: dbLevel,
        current_level: overall,
        throughput,
        recovery_rate: recoveryRate,
        fatigue_risk: fatigueRisk,
        tasks_completed: nextCompleted,
        tasks_failed: nextFailed,
        streak_current: nextStreak,
        streak_best: nextBest,
        metadata: {
          ...(typeof profile.metadata === "object" && profile.metadata !== null
            ? (profile.metadata as Record<string, unknown>)
            : {}),
          throughput_rate: Math.min(1, tasksPerDay / 3),
          last_feedback_id: feedbackRow.id,
        },
        updated_at: new Date(),
      })
      .where(eq(capabilityProfiles.user_id, userId));

    await db
      .insert(capabilityHistory)
      .values({
        user_id: userId,
        blueprint_id: feedbackRow.blueprint_id,
        trigger_event: EVENT_TYPES.FEEDBACK_SUBMITTED,
        snapshot: {
          execution_quality: executionQuality,
          consistency_score: consistency,
          difficulty_recommendation: difficultyRec,
          overall_level: overall,
          level: dbLevel,
        },
      })
      .catch(() => null);
  }
}

export const capabilityEngine = new CapabilityEngine();

export async function assessCapabilityLevel(userId: string): Promise<{
  level:               string;
  consistencyScore:    number;
  executionQuality:    number;
  throughput:          string;
  fatigueRisk:         string;
  suggestedDifficulty: string;
}> {
  const [profile] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, userId))
    .limit(1);

  if (!profile) {
    return {
      level:               "beginner",
      consistencyScore:    0,
      executionQuality:    0,
      throughput:          "low",
      fatigueRisk:         "low",
      suggestedDifficulty: "easy",
    };
  }

  const since = new Date(Date.now() - 14 * 86400000);
  const recent = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.user_id, userId), gte(feedback.created_at, since)))
    .orderBy(desc(feedback.created_at))
    .limit(20);

  const completedCount = recent.filter(
    f => f.completion_status === "completed" || f.completion_status === "partial",
  ).length;
  const consistencyScore =
    recent.length > 0 ? completedCount / recent.length : profile.consistency_score;

  const avgScore =
    recent.length > 0
      ? recent.reduce((sum, f) => sum + (f.weighted_score ?? f.score ?? 0), 0) / recent.length
      : profile.execution_quality * 10;

  const executionQuality = Math.min(1.0, avgScore / 10);

  let level = "beginner";
  const tasksCompleted = profile.tasks_completed;
  if (
    consistencyScore >= LEVEL_THRESHOLDS.lead.minConsistency &&
    executionQuality >= LEVEL_THRESHOLDS.lead.minQuality &&
    tasksCompleted >= LEVEL_THRESHOLDS.lead.minTasks
  ) {
    level = "lead";
  } else if (
    consistencyScore >= LEVEL_THRESHOLDS.advanced.minConsistency &&
    executionQuality >= LEVEL_THRESHOLDS.advanced.minQuality &&
    tasksCompleted >= LEVEL_THRESHOLDS.advanced.minTasks
  ) {
    level = "advanced";
  } else if (
    consistencyScore >= LEVEL_THRESHOLDS.operator.minConsistency &&
    executionQuality >= LEVEL_THRESHOLDS.operator.minQuality &&
    tasksCompleted >= LEVEL_THRESHOLDS.operator.minTasks
  ) {
    level = "operator";
  }

  const throughput: Throughput =
    consistencyScore >= 0.85
      ? "very_high"
      : consistencyScore >= 0.7
        ? "high"
        : consistencyScore >= 0.5
          ? "moderate"
          : consistencyScore >= 0.3
            ? "low"
            : "very_low";

  const avgFriction =
    recent.length > 0
      ? recent.reduce((sum, f) => sum + (f.friction_score ?? 0), 0) / recent.length
      : 0;
  const failureRate =
    recent.length > 0
      ? recent.filter(f => f.completion_status === "failed").length / recent.length
      : 0;
  const fatigueScore = (avgFriction / 5) * 0.6 + failureRate * 0.4;
  const fatigueRisk: FatigueRisk =
    fatigueScore >= 0.7 ? "critical" : fatigueScore >= 0.5 ? "high" : fatigueScore >= 0.3 ? "moderate" : "low";

  const suggestedDifficulty = deriveDifficultyRecommendation(executionQuality, consistencyScore);

  await db
    .update(capabilityProfiles)
    .set({
      level:             level as InferSelectModel<typeof capabilityProfiles>["level"],
      consistency_score: consistencyScore,
      execution_quality: executionQuality,
      throughput,
      fatigue_risk:       fatigueRisk,
      current_difficulty: suggestedDifficulty as InferSelectModel<
        typeof capabilityProfiles
      >["current_difficulty"],
    })
    .where(eq(capabilityProfiles.user_id, userId))
    .catch(() => null);

  return { level, consistencyScore, executionQuality, throughput, fatigueRisk, suggestedDifficulty };
}

export async function recordDifficultyAttempt(params: {
  userId:           string;
  difficulty:       string;
  completionStatus: string;
  score:            number;
}): Promise<void> {
  const [profile] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  if (!profile) return;

  const capIdx = DIFFICULTY_ORDER.indexOf(
    (profile.current_difficulty ?? "easy") as (typeof DIFFICULTY_ORDER)[number],
  );
  const safeCap = capIdx >= 0 ? capIdx : 1;
  const diffIdx = DIFFICULTY_ORDER.indexOf(params.difficulty as (typeof DIFFICULTY_ORDER)[number]);
  const safeDiff = diffIdx >= 0 ? diffIdx : 1;

  const isSuccess = params.completionStatus === "completed" && params.score >= 7;
  const isStruggle = params.completionStatus === "failed" && safeDiff >= safeCap;

  if (isSuccess && safeCap < DIFFICULTY_ORDER.length - 1) {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(feedback)
      .innerJoin(orders, eq(feedback.order_id, orders.id))
      .where(
        and(
          eq(feedback.user_id, params.userId),
          gte(feedback.created_at, weekAgo),
          eq(feedback.completion_status, "completed"),
          eq(
            orders.difficulty,
            params.difficulty as InferSelectModel<typeof orders>["difficulty"],
          ),
        ),
      );

    if ((c ?? 0) >= 3) {
      await db
        .update(capabilityProfiles)
        .set({
          current_difficulty: DIFFICULTY_ORDER[safeCap + 1] as InferSelectModel<
            typeof capabilityProfiles
          >["current_difficulty"],
        })
        .where(eq(capabilityProfiles.user_id, params.userId))
        .catch(() => null);
    }
  }

  if (isStruggle && safeCap > 0) {
    await db
      .update(capabilityProfiles)
      .set({
        current_difficulty: DIFFICULTY_ORDER[safeCap - 1] as InferSelectModel<
          typeof capabilityProfiles
        >["current_difficulty"],
      })
      .where(eq(capabilityProfiles.user_id, params.userId))
      .catch(() => null);
  }
}
