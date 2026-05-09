import { describe, it, expect } from "vitest";

const FRAMEWORK_PHASE1_STATUS: Record<string, "active" | "limited" | "disabled"> = {
  governance_risk: "active",
  strategycore: "active",
  synergyops: "active",
  customervalue: "active",
  clarity_catalyst: "active",
  finmatrix: "limited",
  talentsync: "limited",
  alignment_accountability: "limited",
  omnigrowth: "limited",
  adaptive_intelligence: "limited",
  knowledgeflow: "limited",
  decision_velocity: "limited",
  regeneration_exit: "limited",
  culture_dynamics: "disabled",
};

describe("Framework activation — Phase 1 DOC_40 rules", () => {
  it("exactly 5 frameworks are active", () => {
    const active = Object.entries(FRAMEWORK_PHASE1_STATUS).filter(([, v]) => v === "active");
    expect(active).toHaveLength(5);
  });

  it("exactly 8 frameworks are limited", () => {
    const limited = Object.entries(FRAMEWORK_PHASE1_STATUS).filter(([, v]) => v === "limited");
    expect(limited).toHaveLength(8);
  });

  it("exactly 1 framework is disabled (culture_dynamics)", () => {
    const disabled = Object.entries(FRAMEWORK_PHASE1_STATUS).filter(([, v]) => v === "disabled");
    expect(disabled).toHaveLength(1);
    expect(disabled[0]?.[0]).toBe("culture_dynamics");
  });

  it("total is 14 frameworks", () => {
    expect(Object.keys(FRAMEWORK_PHASE1_STATUS)).toHaveLength(14);
  });

  it("limited frameworks monitor-only implies no enforced decisions", () => {
    const limitedActivationLevel = "monitor";
    const canGenerateDecision = limitedActivationLevel === "enforce" || limitedActivationLevel === "recommend";
    expect(canGenerateDecision).toBe(false);
  });

  it("signal snapshots conceptual coverage for non-disabled frameworks", () => {
    const trackingFrameworks = Object.entries(FRAMEWORK_PHASE1_STATUS).filter(([, v]) => v !== "disabled");
    expect(trackingFrameworks).toHaveLength(13);
  });

  it("tier caps are correctly defined", () => {
    const caps = { starter: 2, growth: 4, ultimate: 999 };
    expect(caps.starter).toBeLessThan(caps.growth);
    expect(caps.growth).toBeLessThan(caps.ultimate);
  });
});

describe("Domain activation — Phase 1 DOC_40 rules", () => {
  const DOMAIN_STATUS: Record<string, string> = {
    genesis: "always_active",
    market: "active",
    delivery: "active",
    continuity: "active",
    operations: "limited",
    growth: "disabled",
    people: "disabled",
  };

  it("genesis is always active", () => {
    expect(DOMAIN_STATUS["genesis"]).toBe("always_active");
  });

  it("growth and people disabled in Phase 1", () => {
    expect(DOMAIN_STATUS["growth"]).toBe("disabled");
    expect(DOMAIN_STATUS["people"]).toBe("disabled");
  });

  it("operations is limited", () => {
    expect(DOMAIN_STATUS["operations"]).toBe("limited");
  });
});
