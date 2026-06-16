/**
 * ERECTOR Prompt 13 — known verdict fixture catalog for harness tests.
 */
export const KNOWN_PROCEED_FIXTURES = [
  {
    id: "proceed_consulting",
    archetype: "consulting_advisory",
    demand_proof_class: 4,
    budget_usd_estimate: 2000,
    hours_per_week: 15,
    expected_verdict: "PROCEED",
  },
  {
    id: "proceed_nigeria_reseller",
    archetype: "physical_product_inventory",
    operating_context: "informal",
    payment_infrastructure: "mobile_money",
    demand_proof_class: 4,
    expected_verdict: "PROCEED",
  },
  {
    id: "proceed_content_creator",
    archetype: "content_media",
    demand_proof_class: 3,
    expected_verdict: "PROCEED",
  },
] as const;

export const KNOWN_ADJUST_FIXTURES = [
  {
    id: "adjust_saas_low_demand",
    archetype: "saas_platform",
    demand_proof_class: 2,
    expected_verdict: "ADJUST",
    rule: "VR-010",
  },
  {
    id: "adjust_marketplace",
    archetype: "marketplace_exchange",
    demand_proof_class: 3,
    expected_verdict: "ADJUST",
  },
  {
    id: "adjust_missing_revenue_model",
    archetype: "direct_service_delivery",
    revenue_model: null,
    expected_verdict: "ADJUST",
    rule: "VR-050",
  },
] as const;

export const KNOWN_PIVOT_FIXTURES = [
  {
    id: "pivot_enterprise_saas",
    budget_usd_estimate: 0,
    hours_per_week: 2,
    timeline_launch: "30 days",
    expected_verdict: "PIVOT",
    rule: "VR-020",
  },
  {
    id: "pivot_marketplace_zero_demand",
    archetype: "marketplace_exchange",
    demand_proof_class: 0,
    market_viability_score: 15,
    expected_verdict: "PIVOT",
    rules: ["VR-011", "VR-030"],
  },
  {
    id: "pivot_regulatory",
    regulatory_flags: ["license_required"],
    expected_verdict: "PIVOT",
  },
] as const;

export const KNOWN_FALSE_PROGRESS_FIXTURES = [
  {
    id: "false_progress_saas_features",
    archetype: "saas_platform",
    tasks_completed_7d: 20,
    retained_users: 0,
    pattern: "features_without_retained_users",
    min_score: 50,
  },
  {
    id: "false_progress_consulting_content",
    archetype: "consulting_advisory",
    articles_published: 5,
    qualified_conversations: 0,
    pattern: "content_without_qualified_conversations",
  },
] as const;
