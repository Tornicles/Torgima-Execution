import { describe, expect, it } from "vitest";
import { detectFalseProgress } from "../../../engines/intelligence/FalseProgressDetectionEngine.js";
import { getTierProfile, getTaskLimitsForTier, mapStarterSignalLabel } from "../../../services/TierDifferentiationService.js";
import { applyTierToConditionRules } from "../../../services/TierDifferentiationService.js";
import { toDashboardIdentity } from "../../../engines/intelligence/IdentityContinuityEngine.js";

describe("TORGIMA upgrade prompts 1-4", () => {
  it("P1: toDashboardIdentity returns UNFORMED when no row", () => {
    const d = toDashboardIdentity(null);
    expect(d.stage).toBe("UNFORMED");
  });

  it("P2: detectFalseProgress flags activity without outcome", () => {
    const r = detectFalseProgress({
      completionCount: 6,
      evidenceScore: 15,
      outcomeMovementScore: 5,
      hasProof: false,
      avgScore: 8,
    });
    expect(r.detected).toBe(true);
    expect(r.pattern).toBe("ACTIVITY_WITHOUT_OUTCOME");
  });

  it("P4: starter tier limits tasks to 1-2", () => {
    const limits = getTaskLimitsForTier("starter", "stability");
    expect(limits.min).toBe(1);
    expect(limits.max).toBe(2);
    expect(limits.difficultyMax).toBe("medium");
  });

  it("P4: growth tier has higher task cap", () => {
    const profile = getTierProfile("growth");
    expect(profile.taskMax).toBe(4);
    expect(profile.signalMode).toBe("full");
  });

  it("P4: starter signal map simplifies conditions", () => {
    expect(mapStarterSignalLabel("danger")).toBe("STRUGGLING");
    expect(mapStarterSignalLabel("power")).toBe("IMPROVING");
  });

  it("P4: tier overrides cap difficulty for starter", () => {
    const rules = applyTierToConditionRules(
      { taskMin: 1, taskMax: 5, difficultyCap: "very_hard" },
      "starter",
    );
    expect(rules.taskMax).toBeLessThanOrEqual(2);
  });
});
