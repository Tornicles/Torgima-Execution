/**
 * Individual framework — Personal Strategy (Winning Definition, Focus Arena, Resource Reality, Path to Victory).
 */
import type { FrameworkEvaluationResult, InvestigationInput } from "./types.js";
import { adjustConfidence, hasInsight } from "./investigationHelpers.js";

export function personalStrategyLogic(investigations: InvestigationInput): FrameworkEvaluationResult {
  const clearGoal = hasInsight(investigations, "strategy", "goal", "collected");
  const focusOk = hasInsight(investigations, "execution", "task", "throughput");
  const resourcesOk = !hasInsight(investigations, "burn", "runway") || hasInsight(investigations, "runway");
  const pathOk = hasInsight(investigations, "pattern", "completed", "feedback");

  return {
    signal: clearGoal && pathOk ? "stability" : clearGoal ? "urgency" : "nothingness",
    confidence: adjustConfidence(0.8, investigations),
    insights: [
      clearGoal ? "Winning definition is clear" : "Winning definition needs a measurable outcome",
      focusOk ? "Focus arena is defined by active orders" : "Focus arena needs narrowing to one arena",
      resourcesOk ? "Resources are realistic for current phase" : "Resource reality check required",
      pathOk ? "Path to victory has execution evidence" : "Path to victory needs first proof-linked wins",
    ],
    recommendation: "Execute personal strategy with focus",
    domains: ["genesis"],
    role: "lead",
    components: {
      winningDefinition: clearGoal ? "Clear measurable success tied to blueprint goal" : "Define binary win condition + date",
      focusArena: focusOk ? "Active execution queue defines arena" : "Select one market/audience arena for 30 days",
      resourceReality: resourcesOk ? "Budget and time aligned to enforcement package" : "Reconcile weekly hours vs order load",
      pathToVictory: pathOk ? "Next 3 orders form the victory path" : "Complete 3 proof-bearing orders to open path",
    },
  };
}

export const INDIVIDUAL_FRAMEWORK_EVALUATORS: Record<string, typeof personalStrategyLogic> = {
  INDIVIDUAL_MASTERY: personalStrategyLogic,
  PERSONAL_STRATEGY: personalStrategyLogic,
};
