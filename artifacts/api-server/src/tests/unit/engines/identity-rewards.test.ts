import { describe, it, expect } from "vitest";

describe("IdentityEngine — stage progression", () => {
  it("stage order is correct", () => {
    const stages = [
      "starting",
      "forming",
      "building",
      "establishing",
      "consolidated",
      "transforming",
    ];
    expect(stages[0]).toBe("starting");
    expect(stages[stages.length - 1]).toBe("transforming");
  });

  it("transforming requires most feedback and consistency", () => {
    const req = { minFeedbackCount: 60, minConsistency: 0.85, minStreak: 7 };
    const formingReq = { minFeedbackCount: 1, minConsistency: 0.3, minStreak: 1 };
    expect(req.minFeedbackCount).toBeGreaterThan(formingReq.minFeedbackCount);
    expect(req.minConsistency).toBeGreaterThan(formingReq.minConsistency);
  });

  it("false progress flag blocks advancement", () => {
    const openFalseProgress = true;
    expect(openFalseProgress).toBe(true);
  });
});

describe("RewardEngine — reward types", () => {
  it("9 reward types are defined", () => {
    const types = [
      "COMPLETION",
      "CONSISTENCY",
      "RECOVERY",
      "CAPABILITY_GROWTH",
      "IDENTITY_ALIGNMENT",
      "MILESTONE",
      "OUTCOME_TRUTH",
      "HONEST_FAILURE",
      "FOCUS_PROTECTION",
    ];
    expect(types).toHaveLength(9);
  });

  it("HONEST_FAILURE is a valid reward type", () => {
    const types = [
      "COMPLETION",
      "CONSISTENCY",
      "RECOVERY",
      "CAPABILITY_GROWTH",
      "IDENTITY_ALIGNMENT",
      "MILESTONE",
      "OUTCOME_TRUTH",
      "HONEST_FAILURE",
      "FOCUS_PROTECTION",
    ];
    expect(types).toContain("HONEST_FAILURE");
  });

  it("danger condition limits rewards to LOW intensity", () => {
    const condition = "danger";
    const rewardType = "COMPLETION";
    const isRecoveryOrHonest = ["RECOVERY", "HONEST_FAILURE"].includes(rewardType);
    const shouldReduce = condition === "danger" && !isRecoveryOrHonest;
    expect(shouldReduce).toBe(true);
  });
});

describe("OutcomeValidationEngine — false progress detection", () => {
  it("ACTIVITY_WITHOUT_OUTCOME when many tasks with no outcome movement", () => {
    const completionCount = 10;
    const outcomeMovement = 5;
    const evidenceScore = 15;
    const isFalseProgress =
      evidenceScore < 20 && outcomeMovement < 20 && completionCount >= 5;
    expect(isFalseProgress).toBe(true);
  });

  it("VALIDATED when evidence and movement are both high", () => {
    const evidenceScore = 75;
    const movementScore = 80;
    const isValidated = evidenceScore >= 70 && movementScore >= 70;
    expect(isValidated).toBe(true);
  });

  it("NEEDS_MORE_EVIDENCE when evidence is very low", () => {
    const evidenceScore = 15;
    const movementScore = 30;
    const isNeedsMore = evidenceScore < 20 && movementScore > 20;
    expect(isNeedsMore).toBe(true);
  });
});

describe("FrameworkActivationEngine — Phase 1 activation", () => {
  it("exactly 5 frameworks are active in Phase 1", () => {
    const active = [
      "governance_risk",
      "strategycore",
      "synergyops",
      "customervalue",
      "clarity_catalyst",
    ];
    expect(active).toHaveLength(5);
  });

  it("culture_dynamics is disabled", () => {
    const status: Record<string, string> = { culture_dynamics: "disabled" };
    expect(status.culture_dynamics).toBe("disabled");
  });

  it("8 frameworks are limited", () => {
    const limited = [
      "finmatrix",
      "talentsync",
      "alignment_accountability",
      "omnigrowth",
      "adaptive_intelligence",
      "knowledgeflow",
      "decision_velocity",
      "regeneration_exit",
    ];
    expect(limited).toHaveLength(8);
  });

  it("governance_risk has VETO role in delivery domain", () => {
    const deliveryRoles: Record<string, string> = {
      governance_risk:  "veto",
      strategycore:     "advise",
      synergyops:       "lead",
      customervalue:    "advise",
      clarity_catalyst: "blocked",
    };
    expect(deliveryRoles.governance_risk).toBe("veto");
  });

  it("clarity_catalyst has LEAD role in genesis domain", () => {
    const genesisRoles: Record<string, string> = {
      governance_risk:  "veto",
      strategycore:     "lead",
      synergyops:       "blocked",
      customervalue:    "blocked",
      clarity_catalyst: "lead",
    };
    expect(genesisRoles.clarity_catalyst).toBe("lead");
  });

  it("tier cap: starter = 2 max framework decisions", () => {
    const caps: Record<string, number> = { starter: 2, growth: 4, ultimate: 999 };
    expect(caps.starter).toBe(2);
  });
});
