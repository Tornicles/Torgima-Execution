import { blueprints, db, growthExecutionPatterns } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { DetectedExecutionPattern, GrowthFeedbackRow } from "../../types/growth.js";
import { GROWTH_SEQUENCE_NUMBER } from "./growthGate.js";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

async function currentSequenceNumber(blueprintId: string): Promise<number> {
  const [row] = await db
    .select({ current_sequence_number: blueprints.current_sequence_number })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return row?.current_sequence_number ?? GROWTH_SEQUENCE_NUMBER;
}

function blockerType(f: GrowthFeedbackRow): string {
  const b = f.blocker_json as Record<string, unknown> | null;
  if (!b || !Object.keys(b).length) return "";
  return String(b.type ?? b.friction ?? "general");
}

function hasBlocker(f: GrowthFeedbackRow): boolean {
  return blockerType(f).length > 0;
}

export const PatternLearningService = {
  detectPatterns(_blueprintId: string, recentFeedback: GrowthFeedbackRow[]): DetectedExecutionPattern[] {
    if (recentFeedback.length < 3) return [];

    const patterns: DetectedExecutionPattern[] = [];

    const blockerPattern = detectBlockerPattern(recentFeedback);
    if (blockerPattern) patterns.push(blockerPattern);

    const qualityPattern = detectQualityPattern(recentFeedback);
    if (qualityPattern) patterns.push(qualityPattern);

    const timingPattern = detectTimingPattern(recentFeedback);
    if (timingPattern) patterns.push(timingPattern);

    const consistencyPattern = detectConsistencyPattern(recentFeedback);
    if (consistencyPattern) patterns.push(consistencyPattern);

    return patterns;
  },

  async recordPattern(blueprintId: string, pattern: DetectedExecutionPattern) {
    const seq = await currentSequenceNumber(blueprintId);
    await db
      .insert(growthExecutionPatterns)
      .values({
        blueprint_id: blueprintId,
        pattern_type: pattern.type,
        pattern_name: pattern.name,
        detected_at_seq: seq,
        occurrence_count: pattern.occurrences,
        confidence: clamp01(pattern.confidence),
        impact: pattern.impact ?? null,
        suggested_fix: pattern.suggestion ?? null,
        last_observed: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          growthExecutionPatterns.blueprint_id,
          growthExecutionPatterns.pattern_type,
          growthExecutionPatterns.pattern_name,
        ],
        set: {
          occurrence_count: pattern.occurrences,
          confidence: clamp01(pattern.confidence),
          impact: pattern.impact ?? null,
          suggested_fix: pattern.suggestion ?? null,
          last_observed: new Date(),
          detected_at_seq: seq,
        },
      });
  },

  async detectAndStore(blueprintId: string, recentFeedback: GrowthFeedbackRow[]) {
    const patterns = this.detectPatterns(blueprintId, recentFeedback);
    for (const p of patterns) {
      await this.recordPattern(blueprintId, p);
    }
    return patterns;
  },

  async getPatterns(blueprintId: string) {
    return db
      .select()
      .from(growthExecutionPatterns)
      .where(eq(growthExecutionPatterns.blueprint_id, blueprintId))
      .orderBy(desc(growthExecutionPatterns.confidence));
  },
};

function detectBlockerPattern(feedback: GrowthFeedbackRow[]): DetectedExecutionPattern | null {
  const blockers = feedback.filter(hasBlocker);
  if (blockers.length < 2) return null;

  const types = blockers.map(blockerType).filter(Boolean);
  const mostCommon = types.sort(
    (a, b) => types.filter((t) => t === b).length - types.filter((t) => t === a).length,
  )[0];
  if (!mostCommon) return null;

  const occurrences = types.filter((t) => t === mostCommon).length;

  return {
    type: "blocker_type",
    name: `Recurring ${mostCommon} blockers`,
    occurrences,
    confidence: Math.min(occurrences / blockers.length, 1),
    impact: "negative",
    suggestion: `Address ${mostCommon} blockers before they accumulate`,
  };
}

function detectQualityPattern(feedback: GrowthFeedbackRow[]): DetectedExecutionPattern | null {
  const scores = feedback.map((f) => f.score ?? f.weighted_score ?? 5);
  if (scores.length < 4) return null;

  const recentAvg = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const older = scores.slice(3);
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const trend = recentAvg - olderAvg;
  if (Math.abs(trend) < 0.5) return null;

  return {
    type: "quality_trend",
    name: trend > 0 ? "Quality improving" : "Quality declining",
    occurrences: Math.round(Math.abs(trend) * 10),
    confidence: clamp01(Math.abs(trend) / 5),
    impact: trend > 0 ? "positive" : "negative",
    suggestion: trend > 0 ? "Current approach is working" : "Reassess your execution pace",
  };
}

function detectTimingPattern(feedback: GrowthFeedbackRow[]): DetectedExecutionPattern | null {
  const withDuration = feedback.filter((f) => (f.duration_minutes ?? 0) > 0);
  if (withDuration.length < 3) return null;

  const avg = withDuration.reduce((s, f) => s + (f.duration_minutes ?? 0), 0) / withDuration.length;
  const accuracy = avg > 0 ? clamp01(60 / Math.max(avg, 1)) : 0.5;

  return {
    type: "execution_timing",
    name: `Typical task duration ~${Math.round(avg)} min`,
    occurrences: withDuration.length,
    confidence: accuracy,
    impact: accuracy > 0.7 ? "positive" : "negative",
    suggestion: accuracy < 0.7 ? "Add buffer to time estimates" : "Your pace estimates are reliable",
  };
}

function detectConsistencyPattern(feedback: GrowthFeedbackRow[]): DetectedExecutionPattern | null {
  const scores = feedback.map((f) => f.score ?? f.weighted_score ?? 5);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev < 1.5) {
    return {
      type: "execution_consistency",
      name: "Consistent execution",
      occurrences: feedback.length,
      confidence: clamp01(1 - stdDev / 5),
      impact: "positive",
      suggestion: "Your execution is reliable and predictable",
    };
  }

  return {
    type: "execution_consistency",
    name: "Highly variable execution",
    occurrences: feedback.length,
    confidence: clamp01(stdDev / 5),
    impact: "negative",
    suggestion: "Look for what triggers your best and worst days",
  };
}
