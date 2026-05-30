import { describe, expect, it } from "vitest";
import {
  buildOnboardingGoalFlatPayload,
  normalizeCommitment,
  normalizeTimeframe,
  validateErectorContext,
} from "@/lib/onboarding-goal-payload";

describe("Start Validation flat payload", () => {
  const context = {
    country: { countryName: "United States", countryCode: "US" },
    domain: "SaaS",
    commitment: "HIGH" as const,
    currentContext: "Solo founder",
    timeframeDays: 90,
    pace: "high",
  };

  it("sends timeframe as string", () => {
    const payload = buildOnboardingGoalFlatPayload(
      {
        selectedGoal: "Refined goal",
        selectedPurpose: "Refined purpose",
        context,
      },
      { idempotencyKey: "k" },
    );
    expect(typeof payload.timeframe).toBe("string");
    expect(payload.timeframe).toBe("90");
  });

  it("sends commitmentLevel as low/medium/high/full", () => {
    const payload = buildOnboardingGoalFlatPayload(
      {
        selectedGoal: "Refined goal",
        selectedPurpose: "Refined purpose",
        context: { ...context, commitment: "INTENSE" },
      },
      { idempotencyKey: "k" },
    );
    expect(payload.commitmentLevel).toBe("full");
  });

  it("does not send context object or raw copies", () => {
    const payload = buildOnboardingGoalFlatPayload(
      {
        selectedGoal: "Refined goal",
        selectedPurpose: "Refined purpose",
        context,
      },
      { idempotencyKey: "k" },
    );
    expect(payload).not.toHaveProperty("context");
    expect(payload).not.toHaveProperty("rawGoal");
    expect(payload).not.toHaveProperty("rawPurpose");
    expect(payload).not.toHaveProperty("selectedGoal");
    expect(payload).not.toHaveProperty("selectedPurpose");
  });

  it("uses selectedGoal and selectedPurpose as goal and purpose", () => {
    const payload = buildOnboardingGoalFlatPayload(
      {
        selectedGoal: "Refined goal",
        selectedPurpose: "Refined purpose",
        context,
      },
      { idempotencyKey: "k" },
    );
    expect(payload.goal).toBe("Refined goal");
    expect(payload.purpose).toBe("Refined purpose");
    expect(payload.location).toBe("United States");
    expect(payload.domain).toBe("SaaS");
  });

  it("normalizeTimeframe and normalizeCommitment helpers", () => {
    expect(normalizeTimeframe("180 days")).toBe("180");
    expect(normalizeCommitment("moderate")).toBe("medium");
  });

  it("context validation blocks missing domain", () => {
    const errors = validateErectorContext({
      country: { countryName: "United States", countryCode: "US" },
      domain: "",
      commitment: "MEDIUM",
      currentContext: "",
      timeframeDays: 90,
      pace: "moderate",
    });
    expect(errors.domain).toBeDefined();
  });

  it("context validation blocks arbitrary country text like D", () => {
    const errors = validateErectorContext({
      country: null,
      domain: "SaaS",
      commitment: "MEDIUM",
      currentContext: "",
      timeframeDays: 90,
      pace: "moderate",
    });
    expect(errors.country).toBeDefined();
  });
});
