import { describe, expect, it } from "vitest";
import { evaluateRulesFromCatalog, evaluateVerdictRule } from "../../../engines/erector/ErectorRuleEngine.js";
import { resolveConflicts } from "../../../engines/erector/RuleConflictResolver.js";
import {
  buildScoringContext,
  classifyArchetypeFromProfile,
  scoreValidationDimensions,
  thresholdRowToTierThresholds,
} from "../../../engines/erector/ValidationScoringEngine.js";
import type {
  RealityProfileRow,
  RuleEvaluationContext,
  VerdictRuleRow,
} from "../../../engines/erector/types/verdict-types.js";

const GROWTH_THRESHOLDS = thresholdRowToTierThresholds({
  tier: "growth",
  proceed_min_score: 70,
  adjust_min_score: 45,
  pivot_max_score: 44,
  market_weight: 0.3,
  demand_weight: 0.3,
  feasibility_weight: 0.25,
  context_weight: 0.15,
  demand_proof_min_class: 3,
});

function profile(overrides: Partial<RealityProfileRow> = {}): RealityProfileRow {
  return {
    id: "profile-1",
    user_id: "user-1",
    intake_session_id: "sess-1",
    structured_goal: "B2B SaaS workflow automation for finance teams",
    goal_measurable_outcome: "50 paying subscribers in 90 days",
    structured_purpose: {
      target_who: "Finance ops leads at SMBs",
      differentiation: "Automates reconciliation with existing ERP exports",
      problem_solved: "Manual spreadsheet reconciliation every month",
      paying_for_alternatives: true,
    },
    industry: "SaaS",
    location: "United States",
    market_scope: "national",
    operating_context: "formal",
    revenue_model: "Monthly subscription",
    price_range: "$99/mo",
    business_type: "SaaS",
    budget_range: "$5,000+",
    budget_usd_estimate: 5000,
    hours_per_week: 20,
    team_size: 1,
    skills_present: ["product", "sales", "marketing"],
    skills_missing: [],
    timeline_launch: "2026-09-01",
    timeline_customers: "2026-10-01",
    timeline_final: "2027-03-01",
    known_blockers: [],
    prior_attempts: [{ what: "Pilot newsletter", why_failed: "Low conversion" }],
    regulatory_flags: [],
    success_30_days: "10 beta users and 3 paid pilots",
    success_90_days: "25 subscribers",
    success_12_months: "200 subscribers",
    payment_infrastructure: "digital_full",
    market_maturity: "established",
    internet_reliability: "high",
    profile_model_version: "v0.1",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const CORE_RULES: VerdictRuleRow[] = [
  {
    id: "r1",
    rule_id: "VR-010",
    rule_name: "Demand below archetype minimum",
    rule_version: "v0.1",
    applies_to_engine: "validation",
    dimension: "demand",
    condition_description: "demand below archetype min",
    threshold_type: "class_gte",
    threshold_value: { archetype_min: true },
    tier_applicability: ["starter", "growth", "ultimate"],
    severity: "HARD_BLOCKER",
    verdict_effect: "ADJUST",
    correction_required: null,
    revalidation_required: false,
    user_visible_reason: "Customer validation is below what your business model requires.",
    bypass_allowed: false,
    active: true,
    created_at: new Date(),
  },
  {
    id: "r2",
    rule_id: "VR-020",
    rule_name: "Feasibility blocked",
    rule_version: "v0.1",
    applies_to_engine: "validation",
    dimension: "feasibility",
    condition_description: "feasibility blocked",
    threshold_type: "flag_present",
    threshold_value: { flag: "blocked" },
    tier_applicability: ["starter", "growth", "ultimate"],
    severity: "HARD_BLOCKER",
    verdict_effect: "PIVOT",
    correction_required: null,
    revalidation_required: false,
    user_visible_reason: "Blocked by feasibility.",
    bypass_allowed: false,
    active: true,
    created_at: new Date(),
  },
  {
    id: "r3",
    rule_id: "VR-060",
    rule_name: "Framework hard veto",
    rule_version: "v0.1",
    applies_to_engine: "simulation",
    dimension: "global",
    condition_description: "framework veto",
    threshold_type: "flag_present",
    threshold_value: { flag: "framework_hard_veto" },
    tier_applicability: ["starter", "growth", "ultimate"],
    severity: "HARD_BLOCKER",
    verdict_effect: "PIVOT",
    correction_required: null,
    revalidation_required: false,
    user_visible_reason: "Framework veto.",
    bypass_allowed: false,
    active: true,
    created_at: new Date(),
  },
];

function evaluateWithRules(
  scores: RuleEvaluationContext["scores"],
  ctx: Omit<RuleEvaluationContext, "scores">,
) {
  return evaluateRulesFromCatalog(CORE_RULES, "run-1", "user-1", { scores, ...ctx });
}

describe("rule-engine", () => {
  it("case 1 PROCEED: strong SaaS, demand class 4, budget $5000, 20hr/week on growth tier", () => {
    const row = profile({
      structured_purpose: {
        target_who: "Finance ops leads",
        differentiation: "ERP reconciliation automation",
        problem_solved: "Manual reconciliation",
        paying_for_alternatives: true,
      },
      goal_measurable_outcome: "I asked 12 finance leads and 8 would pay for automation",
    });
    const archetype = classifyArchetypeFromProfile(row);
    expect(archetype).toBe("saas_platform");

    const scores = scoreValidationDimensions(
      buildScoringContext(row, { missing_fields: [], contradiction_flags: [] }),
      GROWTH_THRESHOLDS,
      archetype,
    );

    expect(scores.demand_proof_class).toBeGreaterThanOrEqual(3);
    expect(scores.overall_validation_score).toBeGreaterThanOrEqual(70);

    const rules = evaluateWithRules(scores, {
      thresholds: GROWTH_THRESHOLDS,
      archetype_id: archetype,
      archetype_minimum_demand_class: 4,
      missing_critical_fields: false,
      framework_hard_veto: false,
      resource_goal_mismatch: false,
      matrix_tier: "growth",
    });

    const verdict = resolveConflicts(rules, scores, GROWTH_THRESHOLDS);
    expect(verdict.verdict).toBe("PROCEED");
  });

  it("case 2 ADJUST: demand_proof_class 2 below SaaS archetype minimum fires VR-010", () => {
    const row = profile({
      goal_measurable_outcome: "Launch soon",
      structured_purpose: {
        target_who: "SMB finance teams",
        differentiation: "Automation",
        problem_solved: "Manual work",
        paying_for_alternatives: false,
      },
      budget_usd_estimate: 3000,
    });
    const archetype = "saas_platform";
    const scores = scoreValidationDimensions(
      buildScoringContext(row, { missing_fields: [], contradiction_flags: [] }),
      GROWTH_THRESHOLDS,
      archetype,
    );

    expect(scores.demand_proof_class).toBeLessThan(4);

    const rules = evaluateWithRules(scores, {
      thresholds: GROWTH_THRESHOLDS,
      archetype_id: archetype,
      archetype_minimum_demand_class: 4,
      missing_critical_fields: false,
      framework_hard_veto: false,
      resource_goal_mismatch: false,
      matrix_tier: "growth",
    });

    expect(rules.rules_fired).toContain("VR-010");
    expect(rules.decisions_to_write.length).toBeGreaterThanOrEqual(1);

    const verdict = resolveConflicts(rules, scores, GROWTH_THRESHOLDS);
    expect(verdict.verdict).toBe("ADJUST");
  });

  it("case 3 PIVOT: feasibility blocked fires VR-020", () => {
    const row = profile({
      structured_goal: "Enterprise SaaS platform for global teams",
      budget_usd_estimate: 0,
      hours_per_week: 2,
      timeline_launch: "25 days",
      success_30_days: "100 paying customers and full-time revenue",
      team_size: 1,
      skills_present: [],
    });
    const archetype = "saas_platform";
    const scores = scoreValidationDimensions(
      buildScoringContext(row, {
        missing_fields: [],
        contradiction_flags: ["RESOURCE_TIMELINE_MISMATCH"],
      }),
      GROWTH_THRESHOLDS,
      archetype,
    );

    expect(scores.feasibility_rating).toBe("blocked");

    const fired = evaluateVerdictRule(CORE_RULES[1]!, {
      scores,
      thresholds: GROWTH_THRESHOLDS,
      archetype_id: archetype,
      archetype_minimum_demand_class: 4,
      missing_critical_fields: false,
      framework_hard_veto: false,
      resource_goal_mismatch: true,
      matrix_tier: "growth",
    });
    expect(fired).toBe(true);

    const rules = evaluateWithRules(scores, {
      thresholds: GROWTH_THRESHOLDS,
      archetype_id: archetype,
      archetype_minimum_demand_class: 4,
      missing_critical_fields: false,
      framework_hard_veto: false,
      resource_goal_mismatch: true,
      matrix_tier: "growth",
    });
    expect(rules.rules_fired).toContain("VR-020");

    const verdict = resolveConflicts(rules, scores, GROWTH_THRESHOLDS);
    expect(verdict.verdict).toBe("PIVOT");
  });

  it("case 4 PIVOT: regulatory violation triggers framework veto VR-060", () => {
    const row = profile({
      regulatory_flags: ["unlicensed medical claims"],
      budget_usd_estimate: 8000,
      hours_per_week: 25,
    });
    const archetype = classifyArchetypeFromProfile(row);
    const scores = scoreValidationDimensions(
      buildScoringContext(row, { missing_fields: [], contradiction_flags: [] }),
      GROWTH_THRESHOLDS,
      archetype,
    );

    const rules = evaluateWithRules(scores, {
      thresholds: GROWTH_THRESHOLDS,
      archetype_id: archetype,
      archetype_minimum_demand_class: 4,
      missing_critical_fields: false,
      framework_hard_veto: true,
      resource_goal_mismatch: false,
      matrix_tier: "growth",
    });

    expect(rules.rules_fired).toContain("VR-060");
    const verdict = resolveConflicts(rules, scores, GROWTH_THRESHOLDS);
    expect(verdict.verdict).toBe("PIVOT");
  });

  it("records a decision row for every fired rule", () => {
    const row = profile({ regulatory_flags: ["compliance blocker"] });
    const scores = scoreValidationDimensions(
      buildScoringContext(row, { missing_fields: ["revenue_model"], contradiction_flags: [] }),
      GROWTH_THRESHOLDS,
      "saas_platform",
    );
    const rules = evaluateWithRules(scores, {
      thresholds: GROWTH_THRESHOLDS,
      archetype_id: "saas_platform",
      archetype_minimum_demand_class: 4,
      missing_critical_fields: true,
      framework_hard_veto: true,
      resource_goal_mismatch: false,
      matrix_tier: "growth",
    });

    expect(rules.decisions_to_write.length).toBe(rules.rules_fired.length);
    for (const fired of rules.rules_fired) {
      expect(rules.decisions_to_write.some((d) => d.rule_id === fired)).toBe(true);
    }
  });
});
