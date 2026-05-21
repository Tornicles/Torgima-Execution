/**
 * GAP G6 — behavior pattern detection after feedback (DOC capability/behavior specs).
 */

import { db, feedback, behaviorPatterns } from "@workspace/db";
import type { FeedbackRow } from "../capability/CapabilityEngine.js";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

type PatternType =
  | "procrastination"
  | "fake_completion"
  | "avoidance"
  | "inconsistency";

export class BehaviorPatternEngine {
  async detectPatterns(userId: string, blueprintId: string): Promise<string[]> {
    const recentFeedback = await db
      .select()
      .from(feedback)
      .where(and(eq(feedback.user_id, userId), eq(feedback.blueprint_id, blueprintId)))
      .orderBy(desc(feedback.created_at))
      .limit(15);

    const patterns: PatternType[] = [];

    const lateCount = recentFeedback.filter((f) => f.late_penalty_applied).length;
    if (lateCount >= 3) patterns.push("procrastination");

    const gamingCount = recentFeedback.filter((f) => f.gaming_flag).length;
    if (gamingCount >= 2) patterns.push("fake_completion");

    const skipCount = recentFeedback.filter((f) => f.completion_status === "skipped").length;
    if (skipCount >= 3) patterns.push("avoidance");

    const completions = recentFeedback
      .slice(0, 6)
      .map((f) => (f.completion_status === "completed" ? 1 : 0));
    const alternations = completions.filter((v, i) => i > 0 && v !== completions[i - 1]).length;
    if (alternations >= 4) patterns.push("inconsistency");

    for (const pattern of patterns) {
      await upsertPattern(userId, blueprintId, pattern, recentFeedback.length);
    }

    if (patterns.length > 0) {
      logger.info(
        { userId, blueprintId, patterns },
        "[BehaviorPatternEngine] Patterns detected",
      );
    }

    return patterns;
  }
}

async function upsertPattern(
  userId: string,
  blueprintId: string,
  patternType: PatternType,
  recentCount: number,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(behaviorPatterns)
    .where(
      and(
        eq(behaviorPatterns.user_id, userId),
        eq(behaviorPatterns.blueprint_id, blueprintId),
        eq(behaviorPatterns.pattern_type, patternType),
        eq(behaviorPatterns.status, "active"),
      ),
    )
    .limit(1);

  const evidence = { recent_count: recentCount, detected_via: "gap_g6_feedback_scan" };

  if (existing) {
    await db
      .update(behaviorPatterns)
      .set({
        frequency: (existing.frequency ?? 1) + 1,
        last_detected_at: new Date(),
        evidence_json: evidence,
      })
      .where(eq(behaviorPatterns.id, existing.id));
    return;
  }

  await db.insert(behaviorPatterns).values({
    user_id: userId,
    blueprint_id: blueprintId,
    pattern_type: patternType,
    severity: patternType === "fake_completion" ? "high" : "medium",
    confidence: 0.75,
    evidence_json: evidence,
    status: "active",
  });
}

export const behaviorPatternEngine = new BehaviorPatternEngine();
