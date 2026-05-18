/**
 * Prompt 7 §6 — pattern_records persistence (wraps scanPatterns).
 */
import { db, patternRecords, feedback, orders } from "@workspace/db";
import { and, eq, gte, desc } from "drizzle-orm";
import { scanPatterns } from "./PatternLearningEngine.js";
import { writeMemory } from "../../bhudhi/MemoryService.js";

const PROMPT7_TYPES = [
  "EXECUTION_STRENGTH",
  "EXECUTION_WEAKNESS",
  "AVOIDANCE_SIGNATURE",
  "RECOVERY_PATTERN",
  "PEAK_PERFORMANCE",
  "CONSISTENCY_SIGNATURE",
] as const;

export async function runPatternAnalysis(userId: string, blueprintId?: string) {
  if (!blueprintId) return [];
  await scanPatterns({ userId, blueprintId, windowDays: 90 });

  const since = new Date(Date.now() - 90 * 86400000);
  const rows = await db
    .select({
      task_type: orders.task_type,
      completion_status: feedback.completion_status,
      score: feedback.score,
    })
    .from(feedback)
    .innerJoin(orders, eq(feedback.order_id, orders.id))
    .where(
      and(eq(feedback.user_id, userId), eq(feedback.blueprint_id, blueprintId), gte(feedback.created_at, since)),
    )
    .orderBy(desc(feedback.created_at))
    .limit(200);

  const byType = new Map<string, { done: number; total: number; scores: number[] }>();
  for (const r of rows) {
    const key = (r.task_type as string) ?? "general";
    const cur = byType.get(key) ?? { done: 0, total: 0, scores: [] };
    cur.total++;
    if (r.completion_status === "completed") cur.done++;
    if (typeof r.score === "number") cur.scores.push(r.score);
    byType.set(key, cur);
  }

  const upserted: (typeof patternRecords.$inferSelect)[] = [];

  for (const [actionType, stats] of byType.entries()) {
    if (stats.total < 5) continue;
    const rate = stats.done / stats.total;
    const avgScore =
      stats.scores.length > 0 ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length : 0;

    const isStrength = rate >= 0.7 && avgScore >= 7;
    const isWeakness = rate < 0.4;
    if (!isStrength && !isWeakness) continue;

    const patternType = isStrength ? "EXECUTION_STRENGTH" : "EXECUTION_WEAKNESS";
    const description = isStrength
      ? `Strong execution on ${actionType} Orders (${Math.round(rate * 100)}% completion).`
      : `Struggle pattern on ${actionType} Orders (${Math.round(rate * 100)}% completion).`;

    const confidence = Math.min(0.95, 0.5 + stats.total * 0.05);

    const [existing] = await db
      .select()
      .from(patternRecords)
      .where(
        and(
          eq(patternRecords.user_id, userId),
          eq(patternRecords.pattern_type, patternType),
          eq(patternRecords.is_active, true),
        ),
      )
      .limit(1);

    if (existing) {
      const [row] = await db
        .update(patternRecords)
        .set({
          description,
          confidence,
          evidence_count: stats.total,
          last_confirmed: new Date(),
          actionable: true,
          metadata_json: { actionType },
        })
        .where(eq(patternRecords.id, existing.id))
        .returning();
      if (row) upserted.push(row);
    } else {
      const [row] = await db
        .insert(patternRecords)
        .values({
          user_id: userId,
          pattern_type: patternType,
          description,
          confidence,
          evidence_count: stats.total,
          actionable: true,
          recommendation: isWeakness ? `Reduce ${actionType} difficulty temporarily.` : undefined,
          metadata_json: { actionType },
        })
        .returning();
      if (row) upserted.push(row);
    }

    await writeMemory({
      userId,
      blueprintId,
      memoryType: "EXECUTION_PATTERN",
      scope: "USER",
      content: description,
      sourceType: "pattern_learning",
      confidence: confidence >= 0.7 ? "HIGH" : "MEDIUM",
    }).catch(() => null);
  }

  return upserted;
}

export async function getActivePatterns(userId: string) {
  return db
    .select()
    .from(patternRecords)
    .where(
      and(eq(patternRecords.user_id, userId), eq(patternRecords.is_active, true), eq(patternRecords.actionable, true)),
    );
}

export { PROMPT7_TYPES };
