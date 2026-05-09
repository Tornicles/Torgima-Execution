/**
 * Prompt 16 — supplemental signal calculation coverage on top of `signal.test.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  calcCompletionRate,
  assignCondition,
  isPowerChange,
  CONDITION_LEVELS,
  calculateMetrics,
} from "../../../engines/signal/SignalCalculationEngine.js";
import { feedback } from "@workspace/db";
import type { SignalMetrics } from "../../../engines/signal/SignalCalculationEngine.types.js";

type FeedbackRow = typeof feedback.$inferSelect;

const row = (o: Partial<FeedbackRow>): FeedbackRow =>
  ({
    id: crypto.randomUUID(),
    order_id: crypto.randomUUID(),
    blueprint_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
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
    ...o,
  }) as FeedbackRow;

describe("calcCompletionRate — extended", () => {
  it("mixed completed / failed / skipped yields expected ratio", () => {
    const fb = [
      row({}),
      row({}),
      row({ completion_status: "failed" }),
      row({ completion_status: "skipped" }),
    ];
    expect(calcCompletionRate(fb)).toBe(0.5);
  });
});

describe("calculateMetrics aggregates", () => {
  it("returns bounded metrics for a populated window", () => {
    const cur = Array.from({ length: 5 }, () => row({ score: 7, weighted_score: 7 }));
    const prior = Array.from({ length: 3 }, () =>
      row({ score: 6, weighted_score: 6, created_at: new Date(Date.now() - 10 * 86400000) }),
    );
    const m = calculateMetrics(cur, prior);
    expect(m.tasks_in_window).toBe(5);
    expect(m.completion_rate).toBeGreaterThanOrEqual(0);
    expect(m.completion_rate).toBeLessThanOrEqual(1);
    expect(["low", "medium", "high", "insufficient_data"]).toContain(m.confidence);
  });
});

describe("assignCondition — representative matrix", () => {
  const makemetrics = (overrides: Partial<SignalMetrics>): SignalMetrics => ({
    completion_rate: 0.5,
    weighted_score: 5.5,
    momentum: 3,
    trend: "stable",
    confidence: "medium",
    tasks_in_window: 5,
    blocker_ratio: 0,
    skip_ratio: 0,
    raw_score: 5.5,
    avg_difficulty_felt: null,
    ...overrides,
  });

  it("assigns nothingness when confidence = insufficient_data", () =>
    expect(assignCondition(makemetrics({ confidence: "insufficient_data", tasks_in_window: 0 }), "urgency")).toBe(
      "nothingness",
    ));

  it("assigns nothingness when fewer than 3 tasks in window", () =>
    expect(assignCondition(makemetrics({ tasks_in_window: 2 }), "urgency")).toBe("nothingness"));

  it("assigns danger when completion < 0.30 AND score < 4.0 AND declining", () =>
    expect(assignCondition(makemetrics({ completion_rate: 0.2, weighted_score: 3.5, trend: "declining", momentum: 0 }), "urgency")).toBe("danger"));

  it("assigns urgency for low-moderate performance", () =>
    expect(assignCondition(makemetrics({ completion_rate: 0.4, weighted_score: 5.0, trend: "flat" }), "stability")).toBe(
      "urgency",
    ));

  it("assigns stability for consistent moderate performance", () =>
    expect(assignCondition(makemetrics({ completion_rate: 0.6, weighted_score: 6.0, trend: "stable" }), "urgency")).toBe(
      "stability",
    ));

  it("assigns power for strong performance with streak", () =>
    expect(
      assignCondition(makemetrics({ completion_rate: 0.75, weighted_score: 7.5, momentum: 4, trend: "rising" }), "stability"),
    ).toBe("power"));

  it("assigns affluence for exceptional performance", () =>
    expect(
      assignCondition(makemetrics({ completion_rate: 0.9, weighted_score: 9.0, momentum: 8, trend: "rising" }), "power"),
    ).toBe("affluence"));
});

describe("isPowerChange", () => {
  it("detects 2-level jump from danger to power", () => expect(isPowerChange("power", "danger")).toBe(true));
  it("detects 2-level drop from affluence to stability", () => expect(isPowerChange("stability", "affluence")).toBe(true));
  it("rejects 1-level change", () => expect(isPowerChange("urgency", "stability")).toBe(false));
  it("rejects same condition", () => expect(isPowerChange("power", "power")).toBe(false));

  it("all 6 base condition levels are ordered correctly", () => {
    expect(CONDITION_LEVELS["nothingness"]!).toBeLessThan(CONDITION_LEVELS["danger"]!);
    expect(CONDITION_LEVELS["danger"]!).toBeLessThan(CONDITION_LEVELS["urgency"]!);
    expect(CONDITION_LEVELS["urgency"]!).toBeLessThan(CONDITION_LEVELS["stability"]!);
    expect(CONDITION_LEVELS["stability"]!).toBeLessThan(CONDITION_LEVELS["power"]!);
    expect(CONDITION_LEVELS["power"]!).toBeLessThan(CONDITION_LEVELS["affluence"]!);
  });
});
