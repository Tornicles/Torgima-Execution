import type { BlueprintTier } from "../../blueprint/infrastructure/blueprint-types.js";
import type {
  EISIntelligence,
  FeasibilityAssessment,
  PISPrediction,
  RiskFlag,
} from "./validation-intelligence-types.js";

export function runPIS(params: {
  goal: string;
  eis: EISIntelligence;
  feasibility: FeasibilityAssessment;
  tier: BlueprintTier;
}): PISPrediction {
  const predicted_obstacles: string[] = [];
  const strategic_assumptions: string[] = [
    "Target audience will engage with proof offer",
    "Weekly execution capacity is maintained",
  ];
  const kill_conditions: string[] = [];

  if (params.eis.demand_signal.demand_type === "speculative") {
    predicted_obstacles.push("Demand remains unproven after initial outreach");
    strategic_assumptions.push("Early buyers exist in this niche");
    kill_conditions.push("Zero paid or committed interest after proof sprint");
  }

  if (params.eis.saturation_level === "critical") {
    predicted_obstacles.push("Differentiation fails against established players");
    kill_conditions.push("Unable to articulate unique value after 30 days");
  }

  if (!params.feasibility.timeframeRealistic) {
    predicted_obstacles.push("Timeline compression causes quality collapse");
    kill_conditions.push("Missed milestone window twice without adjustment");
  }

  predicted_obstacles.push("Motivation drop without visible progress signals");

  let probability_score: number | undefined;
  if (params.tier === "ultimate") {
    probability_score = Math.round(
      params.feasibility.score * 0.5 +
        (params.eis.demand_signal.strength === "strong" ? 25 : params.eis.demand_signal.strength === "moderate" ? 15 : 5) +
        (params.eis.saturation_level === "low" ? 15 : params.eis.saturation_level === "medium" ? 8 : 0),
    );
    probability_score = Math.max(5, Math.min(92, probability_score));
  }

  const risk_flags: RiskFlag[] = predicted_obstacles.slice(0, 3).map((o, i) => ({
    id: `pis-${i + 1}`,
    title: o,
    level: "medium" as const,
    resolvable: true,
    prevention: "Address in phase 1",
    recovery: "Trigger recovery pathway",
    source: "PIS" as const,
  }));

  return {
    risk_flags,
    predicted_obstacles,
    probability_score,
    kill_conditions: params.tier === "ultimate" ? kill_conditions : undefined,
    strategic_assumptions,
  };
}
