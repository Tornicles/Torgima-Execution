import { adaptationSuggestions, blueprints, db } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import type { GrowthFeedbackRow } from "../../types/growth.js";
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

function calculateCompletionRate(feedback: GrowthFeedbackRow[]): number {
  const completed = feedback.filter(
    (f) => f.completion_status === "completed" || f.completion_status === "partial",
  ).length;
  return completed / Math.max(feedback.length, 1);
}

function calculateQualityTrend(feedback: GrowthFeedbackRow[]): number {
  if (feedback.length < 2) return 0;
  const recent = feedback.slice(0, 5);
  const scores = recent.map((f) => f.score ?? f.weighted_score ?? 5);
  const avgRecent = scores.reduce((a, b) => a + b, 0) / scores.length;
  const older = feedback.slice(5, 10);
  const avgPrevious =
    older.reduce((sum, f) => sum + (f.score ?? f.weighted_score ?? 5), 0) /
    Math.max(older.length, 1);
  return (avgRecent - avgPrevious) / 10;
}

function hasBlocker(f: GrowthFeedbackRow): boolean {
  const b = f.blocker_json;
  return Boolean(b && typeof b === "object" && Object.keys(b as object).length > 0);
}

export const AdaptationEngine = {
  suggestAdaptations(blueprintId: string, recentFeedback: GrowthFeedbackRow[]): string[] {
    void blueprintId;
    const suggestions: string[] = [];

    const completionRate = calculateCompletionRate(recentFeedback);
    if (completionRate < 0.6) {
      suggestions.push("completion-rate-low: Consider reducing daily task count");
    }

    const qualityTrend = calculateQualityTrend(recentFeedback);
    if (qualityTrend < -0.1) {
      suggestions.push("quality-declining: Take breaks or reduce scope");
    }

    const blockers = recentFeedback.filter(hasBlocker);
    if (blockers.length >= 3) {
      suggestions.push("blocker-accumulation: Address top blockers before continuing");
    }

    return suggestions;
  },

  async recordSuggestion(
    blueprintId: string,
    category: string,
    currentBehavior: string,
    suggestedChange: string,
    reasoning: string,
    confidence: number,
    patternDetected?: string,
  ) {
    const [row] = await db
      .insert(adaptationSuggestions)
      .values({
        blueprint_id: blueprintId,
        sequence_number: await currentSequenceNumber(blueprintId),
        pattern_detected: patternDetected ?? category,
        category,
        current_behavior: currentBehavior,
        suggested_change: suggestedChange,
        reasoning,
        confidence: clamp01(confidence),
      })
      .returning();
    return row!;
  },

  async recordFromSuggestionKeys(blueprintId: string, keys: string[], feedback: GrowthFeedbackRow[]) {
    for (const key of keys) {
      const [kind, hint] = key.split(":");
      const category = kind ?? "pace";
      await this.recordSuggestion(
        blueprintId,
        category,
        `Recent completion rate ${(calculateCompletionRate(feedback) * 100).toFixed(0)}%`,
        hint ?? "Adjust execution pace",
        `Detected signal: ${key}`,
        0.65,
        key,
      );
    }
  },

  async recordApplication(suggestionId: string, effectiveness: number) {
    const [updated] = await db
      .update(adaptationSuggestions)
      .set({
        user_applied: true,
        applied_date: new Date(),
        effectiveness: clamp01(effectiveness),
      })
      .where(eq(adaptationSuggestions.id, suggestionId))
      .returning();
    return updated ?? null;
  },

  async getPendingSuggestions(blueprintId: string) {
    return db
      .select()
      .from(adaptationSuggestions)
      .where(
        and(
          eq(adaptationSuggestions.blueprint_id, blueprintId),
          eq(adaptationSuggestions.user_applied, false),
        ),
      )
      .orderBy(desc(adaptationSuggestions.confidence))
      .limit(3);
  },

  async getAllSuggestions(blueprintId: string) {
    return db
      .select()
      .from(adaptationSuggestions)
      .where(eq(adaptationSuggestions.blueprint_id, blueprintId))
      .orderBy(desc(adaptationSuggestions.created_at));
  },
};
