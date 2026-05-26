import { db, feedback } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { SequenceTracker } from "../sequence/SequenceTracker.js";
import { AdaptationEngine } from "./AdaptationEngine.js";
import { InterrogationService } from "./InterrogationService.js";
import { KnowledgeService } from "./KnowledgeService.js";
import { PatternLearningService } from "./PatternLearningService.js";
import { GROWTH_SEQUENCE_NUMBER, isGrowthUnlocked, requireGrowthAccess } from "./growthGate.js";
import type { FeedbackSentiment, GrowthFeedbackRow } from "../../types/growth.js";

function sentimentFromFeedback(rows: GrowthFeedbackRow[]): FeedbackSentiment {
  if (!rows.length) return "neutral";
  const recent = rows[0];
  const score = recent.score ?? recent.weighted_score ?? 5;
  if (score < 5) return "negative";
  if (score >= 8) return "positive";
  return "neutral";
}

function keywordsFromFeedback(rows: GrowthFeedbackRow[]): string[] {
  const text = rows
    .map((r) => r.reflection ?? "")
    .join(" ")
    .toLowerCase();
  return text.split(/\W+/).filter((w) => w.length > 3);
}

export const GrowthIntelligenceService = {
  async runAfterFeedback(blueprintId: string, tier: string | null | undefined) {
    try {
      const row = await requireGrowthAccess(blueprintId);
      if (!isGrowthUnlocked(row)) return { skipped: true, reason: "growth_locked" };

      const recentRows = await db
        .select()
        .from(feedback)
        .where(eq(feedback.blueprint_id, blueprintId))
        .orderBy(desc(feedback.created_at))
        .limit(10);

      const recent = recentRows as GrowthFeedbackRow[];
      const seq = row.current_sequence_number ?? GROWTH_SEQUENCE_NUMBER;

      await KnowledgeService.seedKnowledgeCards(blueprintId, tier ?? "growth");

      const patterns = await PatternLearningService.detectAndStore(blueprintId, recent);
      const adaptationKeys = AdaptationEngine.suggestAdaptations(blueprintId, recent);
      await AdaptationEngine.recordFromSuggestionKeys(blueprintId, adaptationKeys, recent);

      const keywords = keywordsFromFeedback(recent);
      const cards = await KnowledgeService.getRelevantCards(blueprintId, seq, keywords);

      let interrogation: { id: string; question: string } | null = null;
      const ctx = {
        recent_feedback: recent as Array<Record<string, unknown>>,
        current_sequence: seq,
        pattern_suspected: patterns[0]?.type ?? "",
        feedback_sentiment: sentimentFromFeedback(recent),
      };

      if (InterrogationService.shouldAskQuestion(blueprintId, ctx)) {
        const q = InterrogationService.generateQuestion(blueprintId, ctx);
        const log = await InterrogationService.recordQuestion(
          blueprintId,
          q.question,
          q.category,
          q.context,
        );
        interrogation = { id: log.id, question: log.question };
      }

      await SequenceTracker.recordCheckpoint(blueprintId, GROWTH_SEQUENCE_NUMBER, {
        userAction: "Growth intelligence cycle",
        stateSnapshot: {
          patterns: patterns.length,
          adaptations: adaptationKeys.length,
          knowledge_cards: cards.length,
        },
        validationPassed: true,
      }).catch(() => null);

      return {
        skipped: false,
        patterns,
        adaptationKeys,
        knowledgeCards: cards,
        interrogation,
      };
    } catch {
      return { skipped: true, reason: "growth_not_available" };
    }
  },
};
