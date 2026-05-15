import type { BlueprintTier } from "../../blueprint/infrastructure/blueprint-types.js";
import type { ValidationPath } from "../../../types/validation.js";
import type {
  EISIntelligence,
  EnrichedValidationPath,
  FeasibilityAssessment,
  PISPrediction,
  RiskFlag,
  ValidationIntelligencePayload,
  ValidationToBlueprintContract,
} from "./validation-intelligence-types.js";

export function buildValidationToBlueprintContract(params: {
  intelligence: ValidationIntelligencePayload;
  selectedPath: "current" | "adjusted" | "alternative";
  paths: {
    current: EnrichedValidationPath;
    adjusted: EnrichedValidationPath;
    alternative: EnrichedValidationPath;
  };
  tier: BlueprintTier;
}): ValidationToBlueprintContract {
  const path = params.paths[params.selectedPath];
  const { eis, feasibility, pis, iis } = params.intelligence;

  const demandValidationRequired =
    eis.demand_signal.demand_type === "speculative" || eis.demand_signal.strength === "weak";

  const maxPhases =
    feasibility.score < 40 ? 2
    : params.tier === "starter" ? 2
    : feasibility.score < 60 ? 3
    : 4;

  const requiredFirstDomain =
    demandValidationRequired ? "market"
    : eis.saturation_level === "critical" ? "market"
    : eis.domain;

  const scalingBlockedUntil =
    demandValidationRequired ? "stability"
    : eis.saturation_level === "critical" ? "power"
    : null;

  const strategic_adjustments =
    params.selectedPath === "adjusted" ? (path.whatChanged ?? [])
    : params.selectedPath === "alternative" ? ["Alternative strategic entry selected"]
    : [];

  return {
    refined_goal: iis.cleanedGoal,
    measurable_target: extractMeasurable(iis.cleanedGoal),
    execution_version: iis.cleanedGoal,
    industry: eis.industry,
    niche: eis.niche,
    domain: eis.domain,
    demand_signal: eis.demand_signal,
    saturation_level: eis.saturation_level,
    competitive_context: eis.competitor_landscape,
    selected_path_type: params.selectedPath,
    path_summary: path.summary,
    strategic_adjustments,
    risk_flags: params.intelligence.pis.risk_flags,
    probability_score: pis.probability_score,
    predicted_obstacles: pis.predicted_obstacles,
    timeframe_validated: feasibility.timeframeRealistic,
    effort_level: feasibility.effortLevel,
    resource_requirements: feasibility.resourceRequirements,
    feasibility_score: feasibility.score,
    max_phases: maxPhases,
    required_first_domain: requiredFirstDomain,
    demand_validation_required: demandValidationRequired,
    scaling_blocked_until: scalingBlockedUntil,
    plan_skeleton: path.planSkeleton,
  };
}

function extractMeasurable(goal: string): string {
  const m = goal.match(/\$[\d,]+|\d+%|\d+\s*(users|customers|revenue|mrr)/i);
  return m ? m[0] : goal.slice(0, 120);
}

export function applyContractToChainSkeleton(
  contract: ValidationToBlueprintContract,
  existing?: ValidationPath["planSkeleton"],
): ValidationPath["planSkeleton"] {
  let plans = contract.plan_skeleton?.plans ?? existing?.plans ?? [];
  let targets = contract.plan_skeleton?.targets ?? existing?.targets ?? [];

  if (contract.demand_validation_required) {
    const hasValidation = plans.some((p) => /validation|proof|demand/i.test(p.name));
    if (!hasValidation) {
      plans = [{ name: "Demand Proof", description: "Validate real demand before delivery scale" }, ...plans];
      targets = [{ name: "First demand proof", type: "vital" }, ...targets];
    }
  }

  if (contract.saturation_level === "critical") {
    targets = [{ name: "Differentiation proof", type: "vital" }, ...targets];
  }

  for (const obstacle of contract.predicted_obstacles.slice(0, 2)) {
    targets = [{ name: `Prevent: ${obstacle.slice(0, 50)}`, type: "operating" }, ...targets];
  }

  return { plans: plans.slice(0, 4), targets: targets.slice(0, 6) };
}
