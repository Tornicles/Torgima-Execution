/** Canonical blueprint sequence names — SEQUENCE_SPECIFICATION_DATABASE.md */

export const BlueprintSequenceName = {
  GOAL: "GOAL",
  PURPOSE: "PURPOSE",
  CONTEXT: "CONTEXT",
  VALIDATION: "VALIDATION",
  VALIDATION_RESULT: "VALIDATION_RESULT",
  BLUEPRINT_TIER: "BLUEPRINT_TIER",
  POLICY: "POLICY",
  MASTER_PLAN: "MASTER_PLAN",
  SIGNAL: "SIGNAL",
  MINI_PLAN: "MINI_PLAN",
  EXECUTION_STRUCTURE: "EXECUTION_STRUCTURE",
  TASK_GENERATION: "TASK_GENERATION",
  EXECUTION_FEEDBACK: "EXECUTION_FEEDBACK",
  SIGNAL_CONDITION: "SIGNAL_CONDITION",
  ADAPTATION: "ADAPTATION",
  PREDICTION: "PREDICTION",
  PREDICTION_SCENE: "PREDICTION_SCENE",
} as const;

export type BlueprintSequenceName =
  (typeof BlueprintSequenceName)[keyof typeof BlueprintSequenceName];

export type BlueprintTierKey = "starter" | "growth" | "ultimate";

const STARTER_FLOW: BlueprintSequenceName[] = [
  BlueprintSequenceName.GOAL,
  BlueprintSequenceName.PURPOSE,
  BlueprintSequenceName.CONTEXT,
  BlueprintSequenceName.VALIDATION,
  BlueprintSequenceName.VALIDATION_RESULT,
  BlueprintSequenceName.BLUEPRINT_TIER,
  BlueprintSequenceName.POLICY,
  BlueprintSequenceName.MASTER_PLAN,
  BlueprintSequenceName.SIGNAL,
  BlueprintSequenceName.MINI_PLAN,
  BlueprintSequenceName.EXECUTION_STRUCTURE,
  BlueprintSequenceName.TASK_GENERATION,
  BlueprintSequenceName.EXECUTION_FEEDBACK,
  BlueprintSequenceName.SIGNAL_CONDITION,
  BlueprintSequenceName.PREDICTION_SCENE,
];

const GROWTH_FLOW: BlueprintSequenceName[] = [
  ...STARTER_FLOW.slice(0, STARTER_FLOW.indexOf(BlueprintSequenceName.SIGNAL_CONDITION)),
  BlueprintSequenceName.ADAPTATION,
  BlueprintSequenceName.SIGNAL_CONDITION,
  BlueprintSequenceName.PREDICTION_SCENE,
];

const ULTIMATE_FLOW: BlueprintSequenceName[] = [
  ...GROWTH_FLOW.slice(0, GROWTH_FLOW.indexOf(BlueprintSequenceName.PREDICTION_SCENE)),
  BlueprintSequenceName.PREDICTION,
  BlueprintSequenceName.PREDICTION_SCENE,
];

export function flowPathForTier(tier: BlueprintTierKey): BlueprintSequenceName[] {
  if (tier === "ultimate") return [...ULTIMATE_FLOW];
  if (tier === "growth") return [...GROWTH_FLOW];
  return [...STARTER_FLOW];
}

export function totalSequencesForTier(tier: BlueprintTierKey): number {
  return flowPathForTier(tier).length;
}

export function sequenceIndex(name: BlueprintSequenceName, tier: BlueprintTierKey): number {
  const idx = flowPathForTier(tier).indexOf(name);
  return idx >= 0 ? idx + 1 : 0;
}
