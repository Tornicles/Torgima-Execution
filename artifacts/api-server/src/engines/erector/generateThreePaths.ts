import type { ArchetypeRulePack } from "./economic/types.js";
import type {
  DimensionScores,
  FinalVerdictDecision,
  RealityProfileRow,
  ValidationPathPayload,
} from "./types/verdict-types.js";

export interface PathObject {
  path_type: "current" | "adjusted" | "alternative";
  title: string;
  description: string;
  recommended: boolean;
  risk_level: "low" | "medium" | "high";
  feasibility_rating: string;
  timeline_estimate: string;
  required_adjustments: string[];
  key_risks: string[];
  first_three_actions: string[];
  why_this_path: string;
}

function timelineEstimate(profile: RealityProfileRow): string {
  return profile.timeline_launch?.trim() || profile.timeline_customers?.trim() || "90 days";
}

function firstActions(pathType: PathObject["path_type"]): string[] {
  if (pathType === "current") {
    return ["Confirm proof target", "Ship first customer artifact", "Track weekly demand signal"];
  }
  if (pathType === "adjusted") {
    return ["Apply required scope corrections", "Collect stronger demand proof", "Re-run validation checkpoint"];
  }
  return ["Define lower-risk wedge", "Validate alternative demand", "Pause current launch assumptions"];
}

export function generateThreePaths(
  profile: RealityProfileRow,
  scores: DimensionScores,
  finalVerdict: FinalVerdictDecision,
  rulePack: ArchetypeRulePack | null,
): {
  current: PathObject;
  adjusted: PathObject;
  alternative: PathObject;
} {
  const minDemand = rulePack?.minimum_demand_proof_class ?? 3;
  const currentRecommended =
    finalVerdict.verdict === "PROCEED" ||
    (finalVerdict.verdict === "ADJUST" &&
      scores.demand_proof_class >= minDemand &&
      scores.feasibility_rating !== "blocked");

  const adjustedRecommended = finalVerdict.verdict === "ADJUST";
  const alternativeRecommended = finalVerdict.verdict === "PIVOT";

  const timeline = timelineEstimate(profile);

  return {
    current: {
      path_type: "current",
      title: "Current Path",
      description: "Best version of your stated goal under current assumptions.",
      recommended: currentRecommended,
      risk_level: "high",
      feasibility_rating: scores.feasibility_rating,
      timeline_estimate: timeline,
      required_adjustments: [],
      key_risks: finalVerdict.hard_blockers.length
        ? finalVerdict.hard_blockers
        : ["Demand uncertainty", "Execution consistency"],
      first_three_actions: firstActions("current"),
      why_this_path: "Recommended when demand proof and feasibility already support your stated plan.",
    },
    adjusted: {
      path_type: "adjusted",
      title: "Adjusted Path",
      description: "Keep the core outcome but correct the gaps identified during validation.",
      recommended: adjustedRecommended,
      risk_level: "medium",
      feasibility_rating: scores.feasibility_rating,
      timeline_estimate: `${timeline} (+30-60 days validation buffer)`,
      required_adjustments: finalVerdict.correction_fields.length
        ? finalVerdict.correction_fields
        : ["Narrow target customer", "Increase proof cadence"],
      key_risks: finalVerdict.soft_warnings.length
        ? finalVerdict.soft_warnings
        : ["Scope still too broad", "Proof cadence too slow"],
      first_three_actions: firstActions("adjusted"),
      why_this_path: "Recommended when weaknesses are correctable without changing direction.",
    },
    alternative: {
      path_type: "alternative",
      title: "Alternative Path",
      description: "Pursue a lower-risk wedge toward the same outcome with a different method.",
      recommended: alternativeRecommended,
      risk_level: "low",
      feasibility_rating: scores.feasibility_rating,
      timeline_estimate: "Restart with a 60-day validation wedge",
      required_adjustments: ["Change primary method or revenue model", "Reduce capital exposure"],
      key_risks: ["Pivot learning curve", "Temporary momentum loss"],
      first_three_actions: firstActions("alternative"),
      why_this_path: "Recommended when structural blockers make the current plan too risky.",
    },
  };
}

export function pathObjectToValidationPayload(path: PathObject): ValidationPathPayload {
  return {
    pathType: path.path_type,
    title: path.title,
    summary: path.description,
    rationale: path.why_this_path,
    modifications: path.required_adjustments,
    probabilityOfSuccess: path.recommended ? 0.75 : 0.55,
    disabled: path.path_type === "current" && path.recommended === false && !path.required_adjustments.length,
    disabledReason:
      path.path_type === "current" && !path.recommended
        ? "Current path is blocked until corrections or pivot are addressed."
        : undefined,
  };
}
