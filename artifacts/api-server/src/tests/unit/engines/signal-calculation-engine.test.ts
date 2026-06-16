/**
 * DOC B8 — Signal Calculation Engine hardening tests.
 */
import { describe, it, expect } from "vitest";
import { feedback } from "@workspace/db";
import type { SignalMetrics } from "../../../engines/signal/SignalCalculationEngine.types.js";
import {
  assignCondition,
  assignConditionFromB8Matrix,
  calcConfidence,
  CONFIDENCE_WEIGHT_MULTIPLIERS,
  isLateFeedbackSubmission,
  resolveFeedbackConfidenceWeight,
} from "../../../engines/signal/SignalCalculationEngine.js";

type FeedbackRow = typeof feedback.$inferSelect;

const makeMetrics = (overrides: Partial<SignalMetrics>): SignalMetrics => ({
  completion_rate: 0.5,
  weighted_score: 5.5,
  raw_score: 5.5,
  momentum: 2,
  trend: "stable",
  confidence: "medium",
  blocker_ratio: 0,
  skip_ratio: 0,
  tasks_in_window: 5,
  avg_difficulty_felt: null,
  ...overrides,
});

const makeFeedback = (overrides: Partial<FeedbackRow> = {}): FeedbackRow =>
  ({
    id: "00000000-0000-4000-8000-000000000001",
    order_id: "00000000-0000-4000-8000-000000000002",
    blueprint_id: "00000000-0000-4000-8000-000000000003",
    user_id: "00000000-0000-4000-8000-000000000004",
    completion_status: "completed",
    score: 7,
    weighted_score: 7.0,
    reflection: "Detailed reflection with enough content for medium confidence weighting.",
    friction_score: null,
    confidence_score: null,
    duration_minutes: null,
    proof_json: null,
    blocker_json: {},
    interrogation_json: null,
    gaming_flag: false,
    gaming_reason: null,
    late_penalty_applied: false,
    validity: "valid",
    created_at: new Date(),
    ...overrides,
  }) as FeedbackRow;

describe("DOC B8 condition assignment matrix", () => {
  it("1. completion_rate=0.05 → condition = nothingness", () => {
    expect(
      assignConditionFromB8Matrix(
        makeMetrics({ completion_rate: 0.05, weighted_score: 1.5, tasks_in_window: 5 }),
      ),
    ).toBe("nothingness");
  });

  it("2. completion_rate=0.25, trend=declining → condition = danger", () => {
    expect(
      assignConditionFromB8Matrix(
        makeMetrics({
          completion_rate: 0.25,
          weighted_score: 3.5,
          trend: "declining",
          momentum: 0,
        }),
      ),
    ).toBe("danger");
  });

  it("3. completion_rate=0.72, momentum=3, trend=rising → condition = power", () => {
    expect(
      assignConditionFromB8Matrix(
        makeMetrics({
          completion_rate: 0.72,
          weighted_score: 7.5,
          momentum: 3,
          trend: "rising",
        }),
      ),
    ).toBe("power");
  });

  it("4. completion_rate=0.90, momentum=8, trend=rising → condition = affluence", () => {
    expect(
      assignConditionFromB8Matrix(
        makeMetrics({
          completion_rate: 0.9,
          weighted_score: 9.0,
          momentum: 8,
          trend: "rising",
        }),
      ),
    ).toBe("affluence");
  });

  it("5. previous=danger, new=power within 24h → condition = power_change", () => {
    expect(
      assignCondition(
        makeMetrics({
          completion_rate: 0.72,
          weighted_score: 7.5,
          momentum: 3,
          trend: "rising",
        }),
        "danger",
        { previousConditionChangedAt: new Date(Date.now() - 2 * 3600000) },
      ),
    ).toBe("power_change");
  });

  it("9. 0 feedback in window → condition = nothingness", () => {
    expect(
      assignCondition(
        makeMetrics({
          completion_rate: 0,
          weighted_score: 0,
          confidence: "insufficient_data",
          tasks_in_window: 0,
        }),
        "urgency",
      ),
    ).toBe("nothingness");
  });
});

describe("DOC B8 confidence weighting", () => {
  it("6. score=10, reflection=30 chars → gaming flag, weight = 0.3", () => {
    const result = resolveFeedbackConfidenceWeight(
      makeFeedback({ score: 10, reflection: "short reflection under fifty" }),
    );
    expect(result.gaming_flag).toBe(true);
    expect(result.multiplier).toBe(CONFIDENCE_WEIGHT_MULTIPLIERS.gaming);
    expect(result.multiplier).toBe(0.3);
  });

  it("7. 6th feedback in window → confidence = high", () => {
    const rows = Array.from({ length: 6 }, () => makeFeedback());
    expect(calcConfidence(rows)).toBe("high");
  });

  it("8. 1 feedback in window → confidence = low", () => {
    expect(calcConfidence([makeFeedback()])).toBe("low");
  });
});

describe("DOC B8 anti-gaming — late submission", () => {
  it("10. feedback submitted 80 hours after task start → late_penalty_applied = true", () => {
    const startedAt = new Date(Date.now() - 80 * 3600000);
    const createdAt = new Date();
    expect(isLateFeedbackSubmission(createdAt, startedAt)).toBe(true);

    const weight = resolveFeedbackConfidenceWeight(
      makeFeedback({ created_at: createdAt }),
      { taskStartedAt: startedAt },
    );
    expect(weight.late_penalty_applied).toBe(true);
    expect(weight.tier).toBe("low");
  });
});
