import type { BlueprintTier } from "../../blueprint/infrastructure/blueprint-types.js";
import type { ValidationVerdict } from "../../../types/validation.js";
import type {
  EISIntelligence,
  FeasibilityAssessment,
  RiskFlag,
} from "./validation-intelligence-types.js";
import { isGoalMeasurable } from "./IISService.js";

export function determineIntelligenceVerdict(params: {
  eis: EISIntelligence;
  feasibility: FeasibilityAssessment;
  risks: RiskFlag[];
  goal: string;
  tier: BlueprintTier;
  goalMeasurable: boolean;
}): { verdict: ValidationVerdict; reasoning: string; launchBlocked: boolean } {
  const { eis, feasibility, risks, tier, goalMeasurable } = params;

  if (eis.demand_signal.direction === "declining" && eis.demand_signal.strength === "weak") {
    return {
      verdict: "pivot",
      reasoning: "Demand is declining and weak — the current direction lacks market traction.",
      launchBlocked: true,
    };
  }

  if (feasibility.score < 20) {
    return {
      verdict: "pivot",
      reasoning: "Feasibility score is critically low for this goal in the stated timeframe.",
      launchBlocked: true,
    };
  }

  if (risks.some((r) => r.level === "critical" && !r.resolvable)) {
    return {
      verdict: "pivot",
      reasoning: "A critical unresolvable risk blocks safe blueprint launch.",
      launchBlocked: true,
    };
  }

  if (!goalMeasurable && tier !== "starter") {
    return {
      verdict: "adjust",
      reasoning: "Growth+ tiers require a measurable outcome — refine the goal before proceeding.",
      launchBlocked: false,
    };
  }

  if (!feasibility.timeframeRealistic) {
    return {
      verdict: "adjust",
      reasoning: "Timeframe appears unrealistic for this industry — review adjusted path.",
      launchBlocked: false,
    };
  }

  if (eis.saturation_level === "critical") {
    return {
      verdict: "adjust",
      reasoning: "Market saturation is critical — differentiation or alternative path recommended.",
      launchBlocked: false,
    };
  }

  if (
    eis.demand_signal.strength !== "weak" &&
    feasibility.score >= 40 &&
    !risks.some((r) => r.level === "critical")
  ) {
    return {
      verdict: "proceed",
      reasoning: "Demand, feasibility, and risk profile support proceeding with selected path.",
      launchBlocked: false,
    };
  }

  if (params.goal.trim().length < 10) {
    return {
      verdict: "pivot",
      reasoning: "Goal is too vague to build a reliable execution blueprint.",
      launchBlocked: true,
    };
  }

  return {
    verdict: "adjust",
    reasoning: "Direction is viable with modifications — review the adjusted path.",
    launchBlocked: false,
  };
}

export function isGoalMeasurableForVerdict(goal: string): boolean {
  return isGoalMeasurable(goal);
}
