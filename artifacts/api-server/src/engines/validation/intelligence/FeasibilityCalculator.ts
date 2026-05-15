import type { BlueprintTier } from "../../blueprint/infrastructure/blueprint-types.js";
import type { EISIntelligence, FeasibilityAssessment } from "./validation-intelligence-types.js";
import { isGoalMeasurable } from "./IISService.js";

export function calculateFeasibility(params: {
  goal: string;
  timeframe?: string;
  commitmentLevel?: string;
  eis: EISIntelligence;
  tier: BlueprintTier;
}): FeasibilityAssessment {
  let score = 55;
  const risks: string[] = [];

  if (isGoalMeasurable(params.goal)) score += 15;
  else {
    score -= 12;
    risks.push("Goal lacks measurable outcome");
  }

  if (params.timeframe && params.timeframe.trim().length > 2) score += 8;
  else risks.push("No timeframe defined");

  const overReach = /\b(billion|overnight|instant|millions of)\b/i.test(params.goal);
  if (overReach) {
    score -= 25;
    risks.push("Scope may exceed realistic execution window");
  }

  if (params.commitmentLevel === "full" || params.commitmentLevel === "high") score += 10;
  if (params.commitmentLevel === "low") score -= 8;

  if (params.eis.demand_signal.direction === "declining") {
    score -= 20;
    risks.push("Declining demand in target space");
  }
  if (params.eis.saturation_level === "critical") {
    score -= 15;
    risks.push("Highly saturated competitive field");
  }

  score = Math.max(0, Math.min(100, score));

  const timeframeRealistic = !overReach && score >= 35;
  const effortLevel: FeasibilityAssessment["effortLevel"] =
    score >= 70 ? "medium" : score >= 45 ? "high" : "very_high";
  const complexity: FeasibilityAssessment["complexity"] =
    params.eis.saturation_level === "critical" ? "highly_complex"
    : score >= 60 ? "moderate"
    : "complex";

  if (params.tier === "ultimate" && !timeframeRealistic) {
    risks.push("Ultimate tier: timeframe may be unrealistic for industry pace");
  }

  return {
    score,
    effortLevel,
    timeframeRealistic,
    complexity,
    skillRequirements: ["Offer clarity", "Consistent execution", "Demand interpretation"],
    resourceRequirements: [
      `${params.commitmentLevel ?? "medium"} commitment`,
      "Time for weekly proof cycles",
      params.eis.domain === "market" ? "Audience or customer access" : "Execution tooling",
    ],
    risks,
    explanation:
      score >= 60 ?
        "Feasible with disciplined scope and demand validation."
      : score >= 40 ?
        "Achievable after adjustments to scope, timeframe, or positioning."
      : "High friction — pivot or major adjustment recommended before launch.",
  };
}
