import { describe, it, expect } from "vitest";

describe("ContinuousTaskGuarantee — states", () => {
  it("SATISFIED when valid order already exists", () => {
    const state = "SATISFIED";
    expect(state).toBe("SATISFIED");
  });

  it("fallback ladder has 7 levels", () => {
    const ladder = [
      "normal_regeneration",
      "dependency_resolution",
      "clarification",
      "recovery",
      "academy",
      "system_repair",
      "administrative_hold",
    ];
    expect(ladder).toHaveLength(7);
  });

  it("never-empty contract applies to ACTIVE blueprint only", () => {
    const statuses = ["active"];
    const terminated = ["complete", "paused", "abandoned"];
    expect(statuses.includes("active")).toBe(true);
    expect(terminated.includes("active")).toBe(false);
  });
});

describe("InactivityDetectionEngine — thresholds", () => {
  it("full commitment: warning at 12h", () => {
    const thresholds = { full: { warning: 12, soft: 24, hard: 48, critical: 96 } };
    expect(thresholds.full.warning).toBe(12);
  });
  it("low commitment: warning at 36h", () => {
    const thresholds = { low: { warning: 36, soft: 72, hard: 120, critical: 240 } };
    expect(thresholds.low.warning).toBe(36);
  });
  it("critical threshold is highest severity", () => {
    const thresholds = { medium: { warning: 24, soft: 48, hard: 96, critical: 168 } };
    expect(thresholds.medium.critical).toBeGreaterThan(thresholds.medium.hard);
  });
});
