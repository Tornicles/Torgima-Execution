import { describe, expect, it } from "vitest";
import {
  canAdvanceFromStep,
  initialErectorOnboardingState,
  nextStepAfter,
} from "@/lib/erector-onboarding-flow";
import { buildOnboardingGoalFlatPayload } from "@/lib/onboarding-goal-payload";

describe("Erector onboarding state machine", () => {
  it("raw goal submit advances to goal options when 3 options exist", () => {
    const state = {
      ...initialErectorOnboardingState(),
      rawGoal: "Build an app",
      goalOptions: ["a", "b", "c"],
    };
    expect(canAdvanceFromStep("raw_goal", state)).toBe(true);
    expect(nextStepAfter("raw_goal", state)).toBe("goal_options");
  });

  it("selecting goal advances to raw purpose", () => {
    const state = {
      ...initialErectorOnboardingState(),
      selectedGoal: "Refined goal text here",
    };
    expect(nextStepAfter("goal_options", state)).toBe("raw_purpose");
  });

  it("purpose submit advances to purpose options", () => {
    const state = {
      ...initialErectorOnboardingState(),
      rawPurpose: "Why it matters",
      purposeOptions: ["p1", "p2", "p3"],
    };
    expect(nextStepAfter("raw_purpose", state)).toBe("purpose_options");
  });

  it("selecting purpose advances to context", () => {
    const state = {
      ...initialErectorOnboardingState(),
      selectedPurpose: "Refined purpose",
    };
    expect(nextStepAfter("purpose_options", state)).toBe("context");
  });

  it("validation payload uses refined goal/purpose as flat fields", () => {
    const payload = buildOnboardingGoalFlatPayload(
      {
        selectedGoal: "Refined goal for validation",
        selectedPurpose: "Refined purpose for validation",
        context: {
          location: "United States",
          domain: "SaaS",
          commitment: "HIGH",
          currentContext: "Solo founder",
          timeframeDays: 90,
          pace: "high",
        },
      },
      { idempotencyKey: "test-key" },
    );
    expect(payload.goal).toBe("Refined goal for validation");
    expect(payload.purpose).toBe("Refined purpose for validation");
    expect(payload.timeframe).toBe("90");
    expect(payload.location).toBe("United States");
    expect(payload).not.toHaveProperty("rawGoal");
  });
});
