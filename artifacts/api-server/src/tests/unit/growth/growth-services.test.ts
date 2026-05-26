import { describe, expect, it } from "vitest";
import { InterrogationService, extractInterrogationInsight } from "../../../engines/growth/InterrogationService.js";
import { AdaptationEngine } from "../../../engines/growth/AdaptationEngine.js";
import { PatternLearningService } from "../../../engines/growth/PatternLearningService.js";
import { SEED_KNOWLEDGE_CARDS } from "../../../engines/growth/KnowledgeService.js";
import { computeSequenceLocked } from "../../../engines/sequence/SequenceTracker.js";
import { GROWTH_SEQUENCE_NUMBER } from "../../../engines/growth/growthGate.js";

describe("Growth services (Prompt 2)", () => {
  it("should determine when to ask questions", () => {
    const shouldAsk = InterrogationService.shouldAskQuestion("test-bp", {
      recent_feedback: [],
      current_sequence: 24,
      pattern_suspected: "blocker",
      feedback_sentiment: "negative",
    });
    expect(shouldAsk).toBe(true);
  });

  it("should generate questions by category", () => {
    const q = InterrogationService.generateQuestion("test-bp", {
      recent_feedback: [],
      current_sequence: 24,
      pattern_suspected: "blocker",
      feedback_sentiment: "negative",
    });
    expect(q.question.length).toBeGreaterThan(10);
    expect(q.category).toBe("blocker");
  });

  it("extracts actionable interrogation insights", () => {
    const insight = extractInterrogationInsight(
      "What time of day do you do your best work?",
      "I work best in the morning before meetings start",
    );
    expect(insight.actionable).toBe(true);
    expect(insight.suggested_adjustment).toBeDefined();
  });

  it("suggests adaptations from low completion feedback", () => {
    const keys = AdaptationEngine.suggestAdaptations("bp", [
      { completion_status: "failed" },
      { completion_status: "failed" },
      { completion_status: "partial" },
    ]);
    expect(keys.some((k) => k.includes("completion-rate-low"))).toBe(true);
  });

  it("detects blocker patterns with minimum data", () => {
    const patterns = PatternLearningService.detectPatterns("bp", [
      { blocker_json: { type: "technical" }, completion_status: "blocked" },
      { blocker_json: { type: "technical" }, completion_status: "blocked" },
      { completion_status: "completed", score: 8 },
    ]);
    expect(patterns.some((p) => p.type === "blocker_type")).toBe(true);
  });

  it("seeds knowledge card definitions for Growth and Ultimate", () => {
    const growthCards = SEED_KNOWLEDGE_CARDS.filter((c) => c.tier === "Growth");
    expect(growthCards.length).toBeGreaterThanOrEqual(3);
    expect(SEED_KNOWLEDGE_CARDS.some((c) => c.tier === "Ultimate")).toBe(true);
  });

  it("locks sequence 24 for Starter tier", () => {
    expect(computeSequenceLocked(GROWTH_SEQUENCE_NUMBER, "Starter", [23])).toBe(true);
    expect(computeSequenceLocked(GROWTH_SEQUENCE_NUMBER, "Growth", [23])).toBe(false);
  });
});
