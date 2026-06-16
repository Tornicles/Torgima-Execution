import type { SimulationScores, SimulationScoringInput } from "./types.js";

const ARCHETYPE_BASELINE: Record<string, number> = {
  marketplace_exchange: 35,
  direct_service_delivery: 55,
  saas_platform: 25,
  consulting_advisory: 60,
  content_media: 30,
  subscription_recurring: 40,
  subscription_membership: 40,
  information_knowledge_product: 45,
  physical_product_inventory: 35,
  social_enterprise_mission: 40,
  collective_community: 35,
};

const DIGITAL_REVENUE_MODELS = new Set([
  "subscription",
  "saas",
  "transaction_fee",
  "licensing",
  "advertising",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function archetypeNeedsTeam(capitalPressure: string, timelinePressure: string): boolean {
  return capitalPressure === "high" || timelinePressure === "high";
}

function revenueRequiresDigital(revenueModel: string | null | undefined): boolean {
  if (!revenueModel) return false;
  return DIGITAL_REVENUE_MODELS.has(revenueModel.toLowerCase());
}

export function calculateSimulationScores(input: SimulationScoringInput): SimulationScores {
  const { profile, rulePack, demandProofClass, marketViabilityScore, feasibilityRating } = input;
  const archetypeId = rulePack.archetype_id;
  const base = ARCHETYPE_BASELINE[archetypeId] ?? 40;
  const modifiers: string[] = [];
  let modifierTotal = 0;

  if (demandProofClass === 5) {
    modifierTotal += 15;
    modifiers.push("demand_proof_class_5:+15");
  } else if (demandProofClass === 4) {
    modifierTotal += 10;
    modifiers.push("demand_proof_class_4:+10");
  } else if (demandProofClass === 3) {
    modifierTotal += 5;
    modifiers.push("demand_proof_class_3:+5");
  }

  if (demandProofClass < rulePack.minimum_demand_proof_class) {
    modifierTotal -= 20;
    modifiers.push("demand_below_archetype_minimum:-20");
  }

  const rating = (feasibilityRating ?? "").toLowerCase();
  if (rating === "strongly_feasible") {
    modifierTotal += 10;
    modifiers.push("feasibility_strongly_feasible:+10");
  } else if (rating === "unlikely") {
    modifierTotal -= 15;
    modifiers.push("feasibility_unlikely:-15");
  } else if (rating === "blocked") {
    modifierTotal -= 30;
    modifiers.push("feasibility_blocked:-30");
  }

  if (marketViabilityScore > 80) {
    modifierTotal += 10;
    modifiers.push("market_viability_strong:+10");
  } else if (marketViabilityScore < 40) {
    modifierTotal -= 15;
    modifiers.push("market_viability_weak:-15");
  }

  const priorAttempts = Array.isArray(profile.prior_attempts) ? profile.prior_attempts : [];
  if (priorAttempts.length) {
    modifierTotal += 5;
    modifiers.push("prior_attempts:+5");
  }

  if (
    profile.team_size === 1 &&
    archetypeNeedsTeam(rulePack.capital_pressure, rulePack.timeline_pressure)
  ) {
    modifierTotal -= 10;
    modifiers.push("solo_team_high_pressure_archetype:-10");
  }

  if (
    profile.payment_infrastructure === "cash_primary" &&
    revenueRequiresDigital(profile.revenue_model)
  ) {
    modifierTotal -= 10;
    modifiers.push("cash_primary_vs_digital_revenue:-10");
  }

  if (profile.market_maturity === "saturated") {
    modifierTotal -= 10;
    modifiers.push("market_saturated:-10");
  } else if (profile.market_maturity === "emerging") {
    modifierTotal += 5;
    modifiers.push("market_emerging:+5");
  }

  const probabilityProceed = clamp(base + modifierTotal, 5, 90);
  const probabilityFailure = Math.max(5, 100 - probabilityProceed - 20);
  const probabilityAdjust = 100 - probabilityProceed - probabilityFailure;

  let simulationConfidence: SimulationScores["simulation_confidence"] = "LOW";
  if (demandProofClass >= 4 && marketViabilityScore >= 60) {
    simulationConfidence = "HIGH";
  } else if (demandProofClass >= 3 || marketViabilityScore >= 50) {
    simulationConfidence = "MEDIUM";
  }

  return {
    probability_proceed: probabilityProceed,
    probability_adjust: probabilityAdjust,
    probability_failure: probabilityFailure,
    simulation_confidence: simulationConfidence,
    economic_constraints: {
      archetype_baseline_pct: base,
      modifier_total_pct: modifierTotal,
      modifiers_applied: modifiers,
      capital_pressure: rulePack.capital_pressure,
      timeline_pressure: rulePack.timeline_pressure,
    },
    civilization_constraints: {
      market_maturity: profile.market_maturity,
      operating_context: profile.operating_context,
      internet_reliability: profile.internet_reliability,
      payment_infrastructure: profile.payment_infrastructure,
      regulatory_flags: profile.regulatory_flags ?? [],
    },
  };
}
