import { describe, expect, it } from "vitest";
import {
  analyzePatternsFromFeedbackRows,
  interpretContext,
  interpretFeedback,
  interpretGoal,
  interpretPurpose,
} from "../../../engines/bhudhi/BhudhiInterpretationEngine.js";

describe("BhudhiInterpretationEngine (BHUDHI_SYSTEM_SPECIFICATION)", () => {
  it("interprets goal with extraction, gaps, and 3 refinement options", async () => {
    const result = await interpretGoal("I want to create a fitness app");
    expect(result.goal_extraction.object).toContain("fitness");
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.ambiguity_level).toBeGreaterThanOrEqual(1);
    expect(result.refinement_options).toHaveLength(3);
    expect(result.refinement_options[0]?.confidence).toBeGreaterThan(0.5);
  });

  it("interprets purpose with clarity scores", async () => {
    const result = await interpretPurpose("I want to help Africans stay fit", {
      goalContext: "Build a fitness app",
    });
    expect(result.purpose_extraction.problem.length).toBeGreaterThan(5);
    expect(result.clarity_scores.problem).toBeGreaterThan(0);
    expect(result.refinement_options).toHaveLength(3);
  });

  it("interprets execution context into workload model", () => {
    const result = interpretContext({
      timeframe: "90 days",
      location: "United States",
      business_type: "Mobile App",
      people: 1,
      commitment: "part-time",
      budget: "$3,000",
      limits: ["no external funding", "solo founder"],
    });
    expect(result.workload_model.hours_available_per_week).toBe(20);
    expect(result.extracted_execution_pressure).toBeGreaterThan(0.5);
    expect(result.constraint_severity.team).toBeGreaterThan(0.8);
  });

  it("interprets partial feedback with blocker analysis", async () => {
    const result = await interpretFeedback({
      completed: "PARTIAL",
      score: 7,
      reflection: "Operations took longer than expected",
      blocker: "Authentication complexity higher than estimated",
      confidence: 0.8,
    });
    expect(result.completion_score).toBeCloseTo(0.7, 1);
    expect(result.blocker_analysis.detected).toBe(true);
    expect(result.blocker_analysis.type).toContain("technical");
    expect(result.feedback_quality).toBe("high");
  });

  it("analyzes patterns from inline feedback history", () => {
    const rows = Array(10)
      .fill(null)
      .map((_, i) => ({
        id: `f-${i}`,
        order_id: null,
        blueprint_id: "bp",
        user_id: "u",
        completion_status: i < 7 ? "completed" : "partial",
        score: [8, 7, 6, 7, 8, 9, 5, 7, 6, 8][i],
        weighted_score: [8, 7, 6, 7, 8, 9, 5, 7, 6, 8][i],
        reflection: "",
        blocker_json: i < 3 ? { type: "test" } : null,
        proof_json: null,
        friction_score: null,
        confidence_score: null,
        created_at: new Date(),
      })) as unknown as Parameters<typeof analyzePatternsFromFeedbackRows>[0];

    const patterns = analyzePatternsFromFeedbackRows(rows);
    expect(patterns.patterns.completion).toBeGreaterThan(0.6);
    expect(patterns.ready_for_signals).toBe(true);
  });
});
