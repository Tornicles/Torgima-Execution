export const GROWTH_SEQUENCE_NUMBER = 24;
export const ULTIMATE_SEQUENCE_NUMBER = 25;

export type BlueprintTierLabel = "Starter" | "Growth" | "Ultimate";

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

export type SequenceStatusPayload = {
  blueprintId: string;
  tier: BlueprintTierLabel;
  currentSequence: number;
  completedCount: number;
  totalSequences: number;
  progress: number;
  sequences: Array<{
    number: number;
    name: string;
    tier?: string;
    completed: boolean;
    locked: boolean;
  }>;
};

export type FeatureStatusPayload = {
  sequenceStatus: SequenceStatusPayload;
  features: Record<FeatureKey, { available: boolean; reason: string | null; label: string }>;
  navigation: Array<{
    label: string;
    href: string;
    locked: boolean;
    lockReason?: string;
    group?: string;
  }>;
  tierHint: string;
};

export function normalizeTier(raw?: string | null): BlueprintTierLabel {
  const v = (raw ?? "starter").toLowerCase();
  if (v === "growth") return "Growth";
  if (v === "ultimate") return "Ultimate";
  return "Starter";
}
