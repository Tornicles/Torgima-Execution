/**
 * SignalCalculationEngine — metric + assignment helpers (Prompt 7).
 */

import { describe, it, expect } from "vitest";
import {
  calcCompletionRate,
  calcWeightedScore,
  calcMomentum,
  calcTrend,
  calcConfidence,
  calcBlockerRatio,
  calcSkipRatio,
  assignCondition,
  isPowerChange,
  CONDITION_LEVELS,
} from "../../../engines/signal/SignalCalculationEngine.js";

import { feedback } from "@workspace/db";

type FeedbackRow = typeof feedback.$inferSelect;

const makeFeedback = (overrides: Partial<FeedbackRow> & Record<string, unknown> = {}) =>
  ({
    id: "00000000-0000-4000-8000-000000000001",
    order_id: "00000000-0000-4000-8000-000000000002",
    blueprint_id: "00000000-0000-4000-8000-000000000003",
    user_id: "00000000-0000-4000-8000-000000000004",
    completion_status: "completed",
    score: 7,
    weighted_score: 7.0,
    reflection: null,
    friction_score: null,
    confidence_score: null,
    duration_minutes: null,
    proof_json: null,
    blocker_json: {},
    interrogation_json: null,
    gaming_flag: false,
    gaming_reason: null,
    validity: "valid",
    created_at: new Date(),
    ...overrides,
  }) as FeedbackRow;

describe("calcCompletionRate", () => {
  it("returns 0 for empty array", () => expect(calcCompletionRate([])).toBe(0));
  it("returns 1.0 for all completed", () =>
    expect(calcCompletionRate([makeFeedback(), makeFeedback()])).toBe(1.0));
  it("counts partial as completion", () =>
    expect(calcCompletionRate([makeFeedback({ completion_status: "partial" })])).toBe(1.0));
  it("does not count failed", () =>
    expect(calcCompletionRate([makeFeedback({ completion_status: "failed" })])).toBe(0));
  it("mixed: 2 completed 1 failed = 2/3", () => {
    const fb = [makeFeedback(), makeFeedback(), makeFeedback({ completion_status: "failed" })];
    expect(calcCompletionRate(fb)).toBeCloseTo(2 / 3);
  });
});

describe("calcWeightedScore", () => {
  it("returns 0 for empty array", () => expect(calcWeightedScore([])).toBe(0));
  it("returns average of weighted_score", () => {
    const fb = [makeFeedback({ weighted_score: 6 }), makeFeedback({ weighted_score: 8 })];
    expect(calcWeightedScore(fb)).toBe(7);
  });
});

describe("calcMomentum", () => {
  it("returns 0 for empty array", () => expect(calcMomentum([])).toBe(0));
  it("returns 0 when no completions", () => {
    const fb = [makeFeedback({ completion_status: "failed" })];
    expect(calcMomentum(fb)).toBe(0);
  });
});

describe("calcTrend", () => {
  it("returns flat when no prior data", () => expect(calcTrend(7, 0, 0.6, 0, 0)).toBe("flat"));
  it("returns rising when +1.5 score", () => expect(calcTrend(8, 6.5, 0.7, 0.6, 5)).toBe("rising"));
  it("returns declining when -1.5 score", () => expect(calcTrend(5, 6.5, 0.5, 0.6, 5)).toBe("declining"));
  it("returns recovering when was low", () => expect(calcTrend(5.5, 4.0, 0.5, 0.3, 5)).toBe("recovering"));
  it("returns stable for small delta", () => expect(calcTrend(7, 6.8, 0.6, 0.6, 5)).toBe("stable"));
});

describe("calcConfidence", () => {
  it("returns insufficient_data for empty", () => expect(calcConfidence([])).toBe("insufficient_data"));
  it("returns low for fewer than 3", () => expect(calcConfidence([makeFeedback()])).toBe("low"));
  it("returns medium for 3–5 clean feedback", () => {
    const fb = Array(4)
      .fill(null)
      .map(() => makeFeedback());
    expect(calcConfidence(fb)).toBe("medium");
  });
  it("returns high for 6+ clean feedback", () => {
    const fb = Array(7)
      .fill(null)
      .map(() => makeFeedback());
    expect(calcConfidence(fb)).toBe("high");
  });
  it("returns low when gaming_ratio > 0.3", () => {
    const fb = [
      makeFeedback({ gaming_flag: true }),
      makeFeedback({ gaming_flag: true }),
      makeFeedback(),
      makeFeedback(),
    ];
    expect(calcConfidence(fb)).toBe("low");
  });
});

describe("assignCondition", () => {
  it("assigns nothingness for insufficient data", () => {
    const m = {
      completion_rate: 0,
      weighted_score: 0,
      momentum: 0,
      trend: "flat",
      confidence: "insufficient_data",
      tasks_in_window: 0,
      blocker_ratio: 0,
      skip_ratio: 0,
      raw_score: 0,
      avg_difficulty_felt: null,
    };
    expect(assignCondition(m, "nothingness")).toBe("nothingness");
  });
  it("assigns danger for low rate + declining", () => {
    const m = {
      completion_rate: 0.2,
      weighted_score: 3.5,
      momentum: 0,
      trend: "declining",
      confidence: "medium",
      tasks_in_window: 5,
      blocker_ratio: 0,
      skip_ratio: 0,
      raw_score: 3.5,
      avg_difficulty_felt: null,
    };
    expect(assignCondition(m, "urgency")).toBe("danger");
  });
  it("assigns power for strong production + operations", () => {
    const m = {
      completion_rate: 0.88,
      weighted_score: 7.8,
      momentum: 2,
      trend: "rising",
      confidence: "high",
      tasks_in_window: 8,
      blocker_ratio: 0,
      skip_ratio: 0,
      raw_score: 7.8,
      avg_difficulty_felt: null,
    };
    expect(assignCondition(m, "stability")).toBe("power");
  });
  it("assigns affluence for peak framework signals", () => {
    const m = {
      completion_rate: 0.92,
      weighted_score: 9.0,
      momentum: 8,
      trend: "rising",
      confidence: "high",
      tasks_in_window: 10,
      blocker_ratio: 0,
      skip_ratio: 0,
      raw_score: 9.0,
      avg_difficulty_felt: null,
    };
    expect(assignCondition(m, "power")).toBe("affluence");
  });
});

describe("isPowerChange", () => {
  it("returns true for 2+ level jump", () => expect(isPowerChange("power", "danger")).toBe(true));
  it("returns true for 2+ level drop", () => expect(isPowerChange("danger", "power")).toBe(true));
  it("returns false for 1 level change", () =>
    expect(isPowerChange("stability", "urgency")).toBe(false));
  it("returns false for same condition", () =>
    expect(isPowerChange("stability", "stability")).toBe(false));
});

describe("CONDITION_LEVELS", () => {
  it("has all 6 base conditions", () => {
    const expected = ["nothingness", "danger", "urgency", "stability", "power", "affluence"];
    expected.forEach((c) => expect(CONDITION_LEVELS).toHaveProperty(c));
  });
  it("levels are in correct order", () => {
    expect(CONDITION_LEVELS.nothingness).toBeLessThan(CONDITION_LEVELS.danger);
    expect(CONDITION_LEVELS.danger).toBeLessThan(CONDITION_LEVELS.urgency);
    expect(CONDITION_LEVELS.urgency).toBeLessThan(CONDITION_LEVELS.stability);
    expect(CONDITION_LEVELS.stability).toBeLessThan(CONDITION_LEVELS.power);
    expect(CONDITION_LEVELS.power).toBeLessThan(CONDITION_LEVELS.affluence);
  });
});
