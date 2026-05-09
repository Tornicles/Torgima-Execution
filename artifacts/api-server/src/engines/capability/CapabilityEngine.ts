import { db, capabilityProfiles, feedback, orders } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";

const DIFFICULTY_ORDER = ["very_easy", "easy", "moderate", "hard", "very_hard"] as const;

const LEVEL_THRESHOLDS = {
  beginner: { minConsistency: 0, minQuality: 0, minTasks: 0 },
  operator: { minConsistency: 0.5, minQuality: 0.5, minTasks: 10 },
  advanced: { minConsistency: 0.7, minQuality: 0.7, minTasks: 30 },
  lead: { minConsistency: 0.85, minQuality: 0.85, minTasks: 75 },
};

type Throughput =
  "very_low" | "low" | "moderate" | "high" | "very_high";
type FatigueRisk = "low" | "moderate" | "high" | "critical";

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

  const levelDifficultyCap: Record<string, string> = {
    beginner: "easy",
    operator: "moderate",
    advanced: "hard",
    lead:     "very_hard",
  };
  const capIdx = DIFFICULTY_ORDER.indexOf(
    (levelDifficultyCap[level] ?? "moderate") as (typeof DIFFICULTY_ORDER)[number],
  );
  const sugIdx = Math.max(0, capIdx - 1);
  const suggestedDifficulty = DIFFICULTY_ORDER[sugIdx] ?? "easy";

  await db
    .update(capabilityProfiles)
    .set({
      level:             level as InferSelectModel<typeof capabilityProfiles>["level"],
      consistency_score: consistencyScore,
      execution_quality: executionQuality,
      throughput,
      fatigue_risk:       fatigueRisk,
      current_difficulty: suggestedDifficulty as InferSelectModel<typeof capabilityProfiles>["current_difficulty"],
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
