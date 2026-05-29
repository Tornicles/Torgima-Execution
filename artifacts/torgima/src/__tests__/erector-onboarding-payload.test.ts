import { describe, expect, it } from "vitest";
import { buildErectorValidationPayload, validateErectorContext } from "@/lib/onboarding-goal-payload";

describe("Erector validation payload", () => {
  it("Start Validation sends selected refined goal and purpose, not raw copies", () => {
    const payload = buildErectorValidationPayload(
      {
        rawGoal: "r",
        selectedGoal: "Selected goal",
        rawPurpose: "p",
        selectedPurpose: "Selected purpose",
        context: {
          location: "US",
          domain: "SaaS",
          commitment: "MEDIUM",
          currentContext: "",
          timeframeDays: 30,
          pace: "moderate",
        },
      },
      { idempotencyKey: "k" },
    );
    expect(payload.goal).not.toBe(payload.rawGoal);
    expect(payload.purpose).not.toBe(payload.rawPurpose);
  });

  it("context validation blocks missing location", () => {
    const errors = validateErectorContext({
      location: "",
      domain: "SaaS",
      commitment: "MEDIUM",
      currentContext: "",
      timeframeDays: 90,
      pace: "moderate",
    });
    expect(errors.location).toBeDefined();
  });
});
