import { describe, expect, it } from "vitest";
import {
  adaptOnboardingGoalRequest,
  normalizeCommitment,
  normalizeTimeframe,
} from "../../../lib/onboardingGoalAdapter.js";

describe("POST /api/onboarding/goal adapter", () => {
  it("accepts legacy flat payload", () => {
    const adapted = adaptOnboardingGoalRequest({
      goal: "Refined goal for validation",
      purpose: "Refined purpose for validation",
      timeframe: "90",
      location: "United States",
      commitmentLevel: "high",
      domain: "SaaS",
      idempotencyKey: "key-1",
    });
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;
    expect(adapted.data.flat.timeframe).toBe("90");
    expect(adapted.data.flat.commitmentLevel).toBe("high");
  });

  it("accepts nested payload and normalizes it", () => {
    const adapted = adaptOnboardingGoalRequest({
      goal: "Selected goal",
      purpose: "Selected purpose",
      rawGoal: "raw goal",
      rawPurpose: "raw purpose",
      timeframe: { start: "2026-01-01", end: "2026-04-01", duration_days: 90, pace: "high" },
      context: {
        location: "Nigeria",
        commitment: "intense",
        domain: "Coaching",
        current_context: "Solo founder",
      },
      idempotencyKey: "key-2",
    });
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;
    expect(adapted.data.flat.timeframe).toBe("90");
    expect(adapted.data.flat.commitmentLevel).toBe("full");
    expect(adapted.data.flat.location).toBe("Nigeria");
    expect(adapted.data.rawGoal).toBe("raw goal");
    expect(adapted.data.rawPurpose).toBe("raw purpose");
  });

  it("invalid timeframe returns 400 fieldErrors", () => {
    const adapted = adaptOnboardingGoalRequest({
      goal: "Valid goal here",
      purpose: "Valid purpose here",
      timeframe: "",
      location: "US",
      commitmentLevel: "medium",
      domain: "SaaS",
      idempotencyKey: "k",
    });
    expect(adapted.ok).toBe(false);
    if (adapted.ok) return;
    expect(adapted.fieldErrors.timeframe).toBeDefined();
  });

  it("unknown root keys do not crash adapter", () => {
    const adapted = adaptOnboardingGoalRequest({
      goal: "Valid goal here",
      purpose: "Valid purpose here",
      timeframe: "60",
      location: "US",
      commitmentLevel: "medium",
      domain: "SaaS",
      idempotencyKey: "k",
      context: { location: "ignored-after-flat", commitment: "low", domain: "Other" },
      rawPurpose: "ignored for validation",
    });
    expect(adapted.ok).toBe(true);
  });

  it("normalizeTimeframe handles object and day strings", () => {
    expect(normalizeTimeframe(180)).toBe("180");
    expect(normalizeTimeframe("180 days")).toBe("180");
    expect(normalizeTimeframe({ duration_days: 60 })).toBe("60");
  });

  it("normalizeCommitment maps intense to full", () => {
    expect(normalizeCommitment("intense")).toBe("full");
    expect(normalizeCommitment("moderate")).toBe("medium");
  });
});
