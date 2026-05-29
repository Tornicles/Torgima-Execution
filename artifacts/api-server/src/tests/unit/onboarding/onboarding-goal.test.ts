import { describe, it, expect } from "vitest";
import { parseOnboardingGoalBody } from "../../../lib/onboardingGoalPayload.js";
import {
  normalizeSelectedPath,
  resolveDefaultSelectedPath,
} from "../../../lib/validationPathSelection.js";

describe("onboarding goal payload", () => {
  it("parses nested contract", () => {
    const parsed = parseOnboardingGoalBody({
      goal: "  Launch a SaaS with 100 customers  ",
      purpose: "  Replace my salary  ",
      timeframe: {
        start: "2026-01-01",
        end: "2026-04-01",
        duration_days: 90,
        pace: "Moderate",
      },
      context: {
        location: "United States",
        commitment: "high",
        domain: "SaaS",
      },
      idempotencyKey: "key-1",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.rawGoal).toBe("Launch a SaaS with 100 customers");
    expect(parsed.data.purpose).toBe("Replace my salary");
    expect(parsed.data.timeframeDays).toBe(90);
    expect(parsed.data.commitmentLevel).toBe("high");
    expect(parsed.data.domain).toBe("SaaS");
  });

  it("parses flat legacy contract", () => {
    const parsed = parseOnboardingGoalBody({
      rawGoal: "Build an agency",
      purpose: "Financial freedom",
      timeframe: "90 days",
      commitmentLevel: "medium",
      idempotencyKey: "key-2",
      domain: "Consulting",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.timeframe).toBe("90 days");
    expect(parsed.data.timeframeDays).toBe(90);
  });

  it("returns fieldErrors for missing goal", () => {
    const parsed = parseOnboardingGoalBody({
      goal: "hi",
      purpose: "valid purpose here",
      timeframe: { start: "2026-01-01", end: "2026-06-01", pace: "Fast" },
      context: { location: "US", commitment: "high", domain: "SaaS" },
      idempotencyKey: "k",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors.goal?.length).toBeGreaterThan(0);
  });
});

describe("validation path selection", () => {
  it("defaults path by verdict", () => {
    expect(resolveDefaultSelectedPath("adjust")).toBe("adjusted");
    expect(resolveDefaultSelectedPath("pivot")).toBe("alternative");
    expect(resolveDefaultSelectedPath("proceed")).toBe("current");
  });

  it("normalizes legacy fields and launch override", () => {
    expect(
      normalizeSelectedPath({ selected_path_type: "adjusted" }, "current"),
    ).toBe("current");
    expect(normalizeSelectedPath({ selected_path: "alternative" })).toBe("alternative");
    expect(
      normalizeSelectedPath({ verdict: "proceed" }, "adjusted"),
    ).toBe("adjusted");
  });
});
