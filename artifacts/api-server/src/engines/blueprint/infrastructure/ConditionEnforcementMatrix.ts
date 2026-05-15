/**
 * Deterministic condition operational contracts — authority for allowed behavior per condition.
 */

export interface ConditionOperationalContract {
  condition: string;
  allowedOrderIntensity: "minimal" | "low" | "normal" | "high";
  allowedProgression: "frozen" | "recovery_only" | "controlled" | "normal" | "accelerated";
  allowedAdaptation: "none" | "stabilize" | "feedback" | "optimize";
  allowedExpansion: boolean;
  allowedOptimization: boolean;
  taskMin: number;
  taskMax: number;
  scalingAllowed: boolean;
}

export const CONDITION_ENFORCEMENT_MATRIX: Record<string, ConditionOperationalContract> = {
  nothingness: {
    condition: "nothingness",
    allowedOrderIntensity: "minimal",
    allowedProgression: "recovery_only",
    allowedAdaptation: "none",
    allowedExpansion: false,
    allowedOptimization: false,
    taskMin: 1,
    taskMax: 2,
    scalingAllowed: false,
  },
  danger: {
    condition: "danger",
    allowedOrderIntensity: "minimal",
    allowedProgression: "frozen",
    allowedAdaptation: "stabilize",
    allowedExpansion: false,
    allowedOptimization: false,
    taskMin: 1,
    taskMax: 1,
    scalingAllowed: false,
  },
  urgency: {
    condition: "urgency",
    allowedOrderIntensity: "low",
    allowedProgression: "controlled",
    allowedAdaptation: "stabilize",
    allowedExpansion: false,
    allowedOptimization: false,
    taskMin: 1,
    taskMax: 2,
    scalingAllowed: false,
  },
  stability: {
    condition: "stability",
    allowedOrderIntensity: "normal",
    allowedProgression: "normal",
    allowedAdaptation: "feedback",
    allowedExpansion: false,
    allowedOptimization: false,
    taskMin: 2,
    taskMax: 3,
    scalingAllowed: false,
  },
  power: {
    condition: "power",
    allowedOrderIntensity: "high",
    allowedProgression: "accelerated",
    allowedAdaptation: "feedback",
    allowedExpansion: true,
    allowedOptimization: false,
    taskMin: 2,
    taskMax: 4,
    scalingAllowed: true,
  },
  affluence: {
    condition: "affluence",
    allowedOrderIntensity: "high",
    allowedProgression: "accelerated",
    allowedAdaptation: "optimize",
    allowedExpansion: true,
    allowedOptimization: true,
    taskMin: 2,
    taskMax: 5,
    scalingAllowed: true,
  },
  power_change: {
    condition: "power_change",
    allowedOrderIntensity: "low",
    allowedProgression: "controlled",
    allowedAdaptation: "stabilize",
    allowedExpansion: false,
    allowedOptimization: false,
    taskMin: 1,
    taskMax: 2,
    scalingAllowed: false,
  },
};

export function getConditionContract(condition: string): ConditionOperationalContract {
  return CONDITION_ENFORCEMENT_MATRIX[condition] ?? CONDITION_ENFORCEMENT_MATRIX.stability;
}
