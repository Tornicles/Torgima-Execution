/**
 * Prompt 7 §7 — Character traits from execution evidence only.
 */
import { db, feedback, orders, characterProgression, conditions } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { checkAndGenerateRewards } from "../reward/RewardSystemEngine.js";

export function calculateCharacterLevel(overallScore: number): number {
  if (overallScore >= 0.98) return 10;
  if (overallScore >= 0.93) return 9;
  if (overallScore >= 0.86) return 8;
  if (overallScore >= 0.76) return 7;
  if (overallScore >= 0.66) return 6;
  if (overallScore >= 0.51) return 5;
  if (overallScore >= 0.36) return 4;
  if (overallScore >= 0.21) return 3;
  if (overallScore >= 0.11) return 2;
  return 1;
}

export async function updateCharacterScores(userId: string) {
  const since30 = new Date(Date.now() - 30 * 86400000);
  const rows = await db
    .select({
      completion_status: feedback.completion_status,
      score: feedback.score,
      reflection: feedback.reflection,
      created_at: feedback.created_at,
      difficulty: orders.difficulty,
      order_id: feedback.order_id,
    })
    .from(feedback)
    .innerJoin(orders, eq(feedback.order_id, orders.id))
    .where(and(eq(feedback.user_id, userId), gte(feedback.created_at, since30)))
    .orderBy(desc(feedback.created_at))
    .limit(200);

  const dayKeys = new Set(rows.map((r) => r.created_at.toISOString().slice(0, 10)));
  const consistency = Math.min(1, dayKeys.size / 30);

  const hardRows = rows.filter((r) =>
    ["hard", "very_hard"].includes((r.difficulty as string) ?? ""),
  );
  const grit =
    hardRows.length > 0
      ? hardRows.filter((r) => r.completion_status === "completed").length / hardRows.length
      : 0;

  const lowMotivation = rows.filter((r) => (r.score ?? 0) <= 5);
  const discipline =
    lowMotivation.length > 0
      ? lowMotivation.filter((r) => r.completion_status === "completed").length /
        lowMotivation.length
      : consistency * 0.5;

  const avgFeedbackQuality =
    rows.length > 0
      ? rows.reduce((s, r) => s + Math.min(1, (r.reflection?.length ?? 0) / 120), 0) / rows.length
      : 0;
  const avgProof =
    rows.filter((r) => r.completion_status === "completed").length / Math.max(1, rows.length);
  const executionIntelligence = Math.min(1, avgFeedbackQuality * 0.6 + avgProof * 0.4);

  const [condHistory] = await db
    .select({ id: conditions.id })
    .from(conditions)
    .where(eq(conditions.user_id, userId))
    .limit(1);

  const adaptability =
    condHistory && rows.length >= 5
      ? rows.filter((r) => r.completion_status === "completed").length / rows.length
      : consistency * 0.7;

  const overall =
    consistency * 0.25 +
    grit * 0.2 +
    discipline * 0.2 +
    executionIntelligence * 0.2 +
    adaptability * 0.15;

  const level = calculateCharacterLevel(overall);

  const [existing] = await db
    .select()
    .from(characterProgression)
    .where(eq(characterProgression.user_id, userId))
    .limit(1);

  const priorLevel = existing?.character_level ?? 1;

  const snapshot = {
    at: new Date().toISOString(),
    consistency,
    grit,
    discipline,
    executionIntelligence,
    adaptability,
    overall,
    level,
  };

  const history = Array.isArray(existing?.trait_history)
    ? [...(existing.trait_history as unknown[]), snapshot].slice(-52)
    : [snapshot];

  const payload = {
    consistency,
    grit,
    discipline,
    execution_intelligence: executionIntelligence,
    adaptability,
    overall_character_score: overall,
    character_level: level,
    trait_history: history,
  };

  let row: typeof characterProgression.$inferSelect;
  if (existing) {
    [row] = await db
      .update(characterProgression)
      .set(payload)
      .where(eq(characterProgression.user_id, userId))
      .returning();
  } else {
    [row] = await db
      .insert(characterProgression)
      .values({ user_id: userId, ...payload })
      .returning();
  }

  if (level > priorLevel) {
    await checkAndGenerateRewards(userId, {
      characterLevelUp: true,
      newLevel: level,
      priorLevel,
    }).catch(() => null);
  }

  return row!;
}

export async function getCharacterProgression(userId: string) {
  const [row] = await db
    .select()
    .from(characterProgression)
    .where(eq(characterProgression.user_id, userId))
    .limit(1);
  return row ?? null;
}
