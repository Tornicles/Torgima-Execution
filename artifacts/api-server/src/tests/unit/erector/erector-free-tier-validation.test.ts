import { describe, expect, it } from "vitest";
import { evaluateFreeTierRules } from "../../../engines/erector/ErectorRuleEngine.js";
import { resolveFreeTierConflicts } from "../../../engines/erector/RuleConflictResolver.js";
import {
  scoreDimensionsForFreeTier,
  type MinimalFreeProfile,
} from "../../../engines/erector/ValidationScoringEngine.js";
import { buildFreeTierPreviewReport } from "../../../engines/erector/VerdictIssuanceEngine.js";
import { normalizeIntake } from "../../../services/erector/intake/IntakeNormalizer.js";

function freeProfile(overrides: Partial<MinimalFreeProfile> = {}): MinimalFreeProfile {
  return {
    industry: "tech",
    location: "Lagos Nigeria",
    budget_range: "Under $500",
    budget_usd_estimate: 300,
    timeline_launch: "6 months",
    operating_context: "informal",
    market_maturity: "emerging",
    ...overrides,
  };
}

describe("free-tier-validation", () => {
  it("scores 5-field free intake with preview flags", () => {
    const normalized = normalizeIntake({
      session_id: "free-1",
      tier: "free",
      section_1_data: {
        industry: "tech",
        location: "Lagos Nigeria",
        budget_range: "Under $500",
        timeline: "6 months",
      },
      section_2_data: {},
      section_3_data: {},
      section_4_data: {},
      section_5_data: {},
      section_6_data: {},
      section_7_data: {},
      section_8_data: {},
    });

    const scores = scoreDimensionsForFreeTier({
      industry: normalized.industry,
      location: normalized.location,
      budget_range: normalized.budget_range,
      budget_usd_estimate: normalized.budget_usd_estimate,
      timeline_launch: normalized.timeline_launch,
      operating_context: normalized.operating_context,
      market_maturity: normalized.market_maturity,
    });

    expect(scores.market_viability_score).toBeGreaterThanOrEqual(40);
    expect(scores.market_viability_score).toBeLessThanOrEqual(70);
    expect(scores.feasibility_score).toBeGreaterThan(0);
    expect(scores.overall_validation_score).toBeGreaterThanOrEqual(40);
    expect(scores.overall_validation_score).toBeLessThanOrEqual(65);
    expect(scores.is_free_tier_preview).toBe(true);
    expect(scores.demand_proof_class).toBe(0);
    expect(scores.demand_proof_score).toBe(0);

    const rules = evaluateFreeTierRules("run-1", "user-1", scores);
    const verdict = resolveFreeTierConflicts(rules, scores);
    expect(["PROCEED", "ADJUST"]).toContain(verdict.verdict);
    expect(verdict.is_free_tier_preview).toBe(true);
  });

  it("low budget reduces feasibility below 50", () => {
    const scores = scoreDimensionsForFreeTier(
      freeProfile({
        budget_range: "Under $100",
        budget_usd_estimate: 50,
      }),
    );

    expect(scores.feasibility_score).toBeLessThan(50);

    const rules = evaluateFreeTierRules("run-2", "user-1", scores);
    expect(rules.soft_warnings).toContain("LOW_FEASIBILITY");
  });

  it("missing industry forces low market score and soft warning", () => {
    const scores = scoreDimensionsForFreeTier(
      freeProfile({
        industry: null,
        market_maturity: "developing",
      }),
    );

    expect(scores.market_viability_score).toBe(20);

    const rules = evaluateFreeTierRules("run-3", "user-1", scores);
    expect(rules.soft_warnings).toContain("INDUSTRY_MISSING");
  });

  it("preview report uses preview language and omits demand proof", () => {
    const scores = scoreDimensionsForFreeTier(freeProfile());
    const rules = evaluateFreeTierRules("run-4", "user-1", scores);
    const verdict = resolveFreeTierConflicts(rules, scores);
    const report = buildFreeTierPreviewReport(verdict, scores);

    expect(report.badge).toBe("Project Intelligence Preview");
    expect(report.user_facing_explanation.toLowerCase()).toContain("preview");
    expect(report.show_demand_proof).toBe(false);
    expect(report.user_facing_explanation.toLowerCase()).not.toContain("demand proof class");
    expect(report.upgrade_cta.toLowerCase()).toContain("upgrade");
  });
});
