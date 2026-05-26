import { GROWTH_SEQUENCE_NUMBER } from "../engines/growth/growthGate.js";
import { ULTIMATE_SEQUENCE_NUMBER } from "../engines/ultimate/ultimateGate.js";
import type { BlueprintTierLabel } from "../types/sequences.js";
import { computeSequenceLocked, normalizeBlueprintTier } from "../engines/sequence/SequenceTracker.js";

export type FeatureKey =
  | "task_management"
  | "feedback_system"
  | "signal_tracking"
  | "interrogation"
  | "knowledge_cards"
  | "adaptation"
  | "pattern_learning"
  | "predictions"
  | "scene_analysis"
  | "continuous_validation"
  | "emergency_orders";

export const FEATURE_GATES: Record<
  FeatureKey,
  { tier: BlueprintTierLabel[]; minSequence: number; label: string }
> = {
  task_management: { tier: ["Starter", "Growth", "Ultimate"], minSequence: 1, label: "Task Management" },
  feedback_system: { tier: ["Starter", "Growth", "Ultimate"], minSequence: 1, label: "Feedback System" },
  signal_tracking: { tier: ["Starter", "Growth", "Ultimate"], minSequence: 10, label: "Signal Tracking" },
  interrogation: { tier: ["Growth", "Ultimate"], minSequence: GROWTH_SEQUENCE_NUMBER, label: "Interrogation" },
  knowledge_cards: { tier: ["Growth", "Ultimate"], minSequence: GROWTH_SEQUENCE_NUMBER, label: "Knowledge Cards" },
  adaptation: { tier: ["Growth", "Ultimate"], minSequence: GROWTH_SEQUENCE_NUMBER, label: "Adaptation Engine" },
  pattern_learning: {
    tier: ["Growth", "Ultimate"],
    minSequence: GROWTH_SEQUENCE_NUMBER,
    label: "Pattern Learning",
  },
  predictions: { tier: ["Ultimate"], minSequence: ULTIMATE_SEQUENCE_NUMBER, label: "Predictions" },
  scene_analysis: { tier: ["Ultimate"], minSequence: ULTIMATE_SEQUENCE_NUMBER, label: "Scene Analysis" },
  continuous_validation: {
    tier: ["Ultimate"],
    minSequence: ULTIMATE_SEQUENCE_NUMBER,
    label: "Continuous Validation",
  },
  emergency_orders: { tier: ["Ultimate"], minSequence: ULTIMATE_SEQUENCE_NUMBER, label: "Emergency Orders" },
};

export function isFeatureAvailable(
  tier: string | null | undefined,
  blueprintTier: string | null | undefined,
  selectedLevel: string | null | undefined,
  completedNumbers: number[],
  featureName: FeatureKey,
): boolean {
  const gate = FEATURE_GATES[featureName];
  if (!gate) return true;

  const normalized = normalizeBlueprintTier(tier, blueprintTier, selectedLevel);
  if (!gate.tier.includes(normalized)) return false;

  return !computeSequenceLocked(gate.minSequence, normalized, completedNumbers);
}

export function getFeatureLockReason(
  tier: string | null | undefined,
  blueprintTier: string | null | undefined,
  selectedLevel: string | null | undefined,
  currentSequence: number,
  completedNumbers: number[],
  featureName: FeatureKey,
): string | null {
  if (
    isFeatureAvailable(tier, blueprintTier, selectedLevel, completedNumbers, featureName)
  ) {
    return null;
  }

  const gate = FEATURE_GATES[featureName];
  if (!gate) return null;

  const normalized = normalizeBlueprintTier(tier, blueprintTier, selectedLevel);
  if (!gate.tier.includes(normalized)) {
    return `This feature requires ${gate.tier[0]} tier`;
  }

  if (computeSequenceLocked(gate.minSequence, normalized, completedNumbers)) {
    return `Unlocks at Sequence ${gate.minSequence} (you are at Sequence ${currentSequence})`;
  }

  return "Feature locked";
}

export function buildFeatureAvailability(input: {
  tier?: string | null;
  blueprint_tier?: string | null;
  selected_blueprint_level?: string | null;
  current_sequence_number: number;
  sequences_completed_numbers: number[];
}) {
  const result: Record<FeatureKey, { available: boolean; reason: string | null; label: string }> =
    {} as Record<FeatureKey, { available: boolean; reason: string | null; label: string }>;

  for (const key of Object.keys(FEATURE_GATES) as FeatureKey[]) {
    const available = isFeatureAvailable(
      input.tier,
      input.blueprint_tier,
      input.selected_blueprint_level,
      input.sequences_completed_numbers,
      key,
    );
    result[key] = {
      available,
      label: FEATURE_GATES[key].label,
      reason: available
        ? null
        : getFeatureLockReason(
            input.tier,
            input.blueprint_tier,
            input.selected_blueprint_level,
            input.current_sequence_number,
            input.sequences_completed_numbers,
            key,
          ),
    };
  }
  return result;
}
