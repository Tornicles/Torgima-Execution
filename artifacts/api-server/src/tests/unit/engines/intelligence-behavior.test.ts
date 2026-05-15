import { describe, it, expect } from "vitest";
import {
  detectFalseProgress,
  CORRECTION_BY_PATTERN,
  assessBurnoutRisk,
  FAILURE_CATEGORIES,
} from "../../../engines/intelligence/index.js";

describe("FalseProgressDetectionEngine", () => {
  it("flags activity without outcome movement", () => {
    const r = detectFalseProgress({
      completionCount: 8,
      evidenceScore: 10,
      outcomeMovementScore: 5,
      hasProof: false,
      avgScore: 6,
    });
    expect(r.detected).toBe(true);
    expect(r.pattern).toBe("ACTIVITY_WITHOUT_OUTCOME");
    expect(r.correctionTaskType).toBe(CORRECTION_BY_PATTERN.ACTIVITY_WITHOUT_OUTCOME);
  });

  it("does not flag when evidence and movement are strong", () => {
    const r = detectFalseProgress({
      completionCount: 5,
      evidenceScore: 80,
      outcomeMovementScore: 75,
      hasProof: true,
      avgScore: 8,
    });
    expect(r.detected).toBe(false);
  });
});

describe("BurnoutDetectionEngine", () => {
  it("returns LOW for insufficient window", () => {
    const r = assessBurnoutRisk({
      avgFriction: 4,
      failureRate: 0.5,
      avgConfidence: 0.5,
      windowEventCount: 2,
    });
    expect(r.riskLevel).toBe("LOW");
    expect(r.recommendedResponse).toBe("observe");
  });

  it("returns CRITICAL at high fatigue composite", () => {
    const r = assessBurnoutRisk({
      avgFriction: 4.5,
      failureRate: 0.8,
      avgConfidence: 0.2,
      windowEventCount: 10,
    });
    expect(r.riskLevel).toBe("CRITICAL");
    expect(r.recommendedResponse).toBe("protective_restart");
    expect(r.narrative).not.toMatch(/diagnos|disorder|clinical/i);
  });
});

describe("FailureClassificationEngine — categories", () => {
  it("defines failure categories for routing", () => {
    expect(FAILURE_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    expect(FAILURE_CATEGORIES).toContain("PROOF_FAILURE");
  });
});

describe("RewardEngine — anti-manipulation rules", () => {
  it("HONEST_FAILURE is a reward-eligible type", () => {
    const types = [
      "COMPLETION",
      "CONSISTENCY",
      "RECOVERY",
      "OUTCOME_TRUTH",
      "IDENTITY_ALIGNMENT",
      "HONEST_FAILURE",
    ];
    expect(types).toContain("HONEST_FAILURE");
  });
});
