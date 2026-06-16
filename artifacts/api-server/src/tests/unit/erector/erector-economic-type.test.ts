import { describe, expect, it } from "vitest";
import { getMinimumDemandProofClass } from "../../../engines/erector/economic/ArchetypeRulePackLoader.js";
import { classifyEconomicTypeFromProfile } from "../../../engines/erector/economic/EconomicTypeClassifier.js";
import { resolveHybridArchetype } from "../../../engines/erector/economic/HybridArchetypeResolver.js";
import type { ArchetypeRulePack, ProfileInput } from "../../../engines/erector/economic/types.js";
import { evaluateVerdictRule } from "../../../engines/erector/ErectorRuleEngine.js";
import type { RealityProfileRow, RuleEvaluationContext } from "../../../engines/erector/types/verdict-types.js";

function profile(overrides: Partial<RealityProfileRow> = {}): ProfileInput {
  return {
    id: "profile-1",
    user_id: "user-1",
    intake_session_id: "sess-1",
    structured_goal: "Default goal",
    goal_measurable_outcome: null,
    structured_purpose: {},
    industry: null,
    location: null,
    market_scope: null,
    operating_context: null,
    revenue_model: null,
    price_range: null,
    business_type: null,
    budget_range: null,
    budget_usd_estimate: null,
    hours_per_week: null,
    team_size: 1,
    skills_present: [],
    skills_missing: [],
    timeline_launch: null,
    timeline_customers: null,
    timeline_final: null,
    known_blockers: [],
    prior_attempts: [],
    regulatory_flags: [],
    success_30_days: null,
    success_90_days: null,
    success_12_months: null,
    payment_infrastructure: null,
    market_maturity: null,
    internet_reliability: null,
    profile_model_version: "v0.1",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("economic-type engine", () => {
  it("classifies monthly SaaS as saas_platform with confidence >= 0.85", () => {
    const result = classifyEconomicTypeFromProfile(
      profile({
        structured_goal: "Monthly SaaS subscription for workflow automation",
        revenue_model: "Monthly subscription",
        business_type: "SaaS",
        price_range: "$49-$99/mo",
        structured_purpose: {
          target_who: "SMB finance teams",
          differentiation: "Self-serve software",
          problem_solved: "Manual reconciliation",
        },
        payment_infrastructure: "digital_full",
      }),
    );

    expect(result.primary_archetype).toBe("saas_platform");
    expect(result.classification_confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("classifies WhatsApp reseller in Nigeria as physical_product_inventory", () => {
    const result = classifyEconomicTypeFromProfile(
      profile({
        structured_goal: "WhatsApp reseller selling physical goods in Lagos",
        revenue_model: "One-time purchase per order",
        business_type: "Physical reseller",
        location: "Nigeria",
        operating_context: "informal",
        payment_infrastructure: "cash",
        price_range: "₦5,000-₦15,000",
        structured_purpose: {
          target_who: "Local buyers on WhatsApp",
          problem_solved: "Affordable household goods",
        },
      }),
    );

    expect(result.primary_archetype).toBe("physical_product_inventory");
  });

  it("classifies paid community plus education as hybrid collective_community and information_knowledge_product", () => {
    const p = profile({
      structured_goal: "Paid community with educational courses and monthly membership",
      revenue_model: "Monthly membership fee",
      business_type: "Community and education",
      price_range: "$29/mo",
      structured_purpose: {
        target_who: "Aspiring designers learning together",
        differentiation: "Live cohort plus course library",
        problem_solved: "Isolation while learning design",
      },
    });

    const result = classifyEconomicTypeFromProfile(p);
    const hybrid = resolveHybridArchetype(p, result);

    expect(result.primary_archetype).toBe("collective_community");
    expect(hybrid.is_hybrid).toBe(true);
    expect(result.classification_confidence).toBeLessThan(0.85);
    expect(hybrid.secondary_archetype).toBe("information_knowledge_product");
  });

  it("classifies freelance design as direct_service_delivery with minimum demand proof class 3", () => {
    const p = profile({
      structured_goal: "Freelance design service for small business branding",
      revenue_model: "Per project fee",
      business_type: "Freelance design service",
      price_range: "$800-$1,500 per project",
      hours_per_week: 25,
      structured_purpose: {
        target_who: "Local small businesses",
        differentiation: "Fast turnaround brand kits",
        problem_solved: "No in-house designer",
      },
    });

    const result = classifyEconomicTypeFromProfile(p);
    expect(result.primary_archetype).toBe("direct_service_delivery");

    const pack: ArchetypeRulePack = {
      id: "pack-1",
      archetype_id: "direct_service_delivery",
      archetype_name: "Direct Service Delivery",
      archetype_version: "v0.1",
      core_risk: "capacity ceiling",
      risk_level: "medium",
      minimum_demand_proof_class: 3,
      demand_proof_description: "Paid client conversations",
      proof_required: [],
      proof_description: "At least one paid or committed client",
      common_failure_modes: [],
      false_progress_patterns: [],
      capital_pressure: "low",
      capital_range_usd_min: 0,
      capital_range_usd_max: 2000,
      timeline_pressure: "medium",
      typical_months_to_traction: 3,
      validation_blockers: [],
      required_phase_gates: [],
      correction_path_templates: [],
      starter_adjustments: {},
      growth_adjustments: {},
      ultimate_adjustments: {},
      active: true,
      created_at: new Date(),
      tier_adjustments_applied: {},
    };

    expect(getMinimumDemandProofClass(pack)).toBe(3);

    const ctx: RuleEvaluationContext = {
      scores: {
        market_viability_score: 70,
        demand_proof_score: 35,
        feasibility_score: 65,
        context_readiness_score: 60,
        contradiction_score: 0,
        evidence_quality_score: 50,
        overall_validation_score: 58,
        demand_proof_class: 2,
        feasibility_rating: "viable",
      },
      thresholds: {
        tier: "growth",
        proceed_min_score: 70,
        adjust_min_score: 45,
        pivot_max_score: 44,
        market_weight: 0.3,
        demand_weight: 0.3,
        feasibility_weight: 0.25,
        context_weight: 0.15,
        demand_proof_min_class: 3,
      },
      archetype_id: "direct_service_delivery",
      archetype_minimum_demand_class: getMinimumDemandProofClass(pack),
      missing_critical_fields: false,
      framework_hard_veto: false,
      resource_goal_mismatch: false,
      matrix_tier: "growth",
    };

    const fired = evaluateVerdictRule(
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
      ctx,
    );

    expect(fired).toBe(true);
  });
});
