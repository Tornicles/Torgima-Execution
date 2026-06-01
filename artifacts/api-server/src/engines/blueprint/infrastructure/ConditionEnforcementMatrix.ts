/**

 * CONDITION_SYSTEM_SPECIFICATION.md — operational contracts per condition.

 */



import { taskLimitsForCondition } from "../../../constants/conditionSpec.js";



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

  recoveryRequired: boolean;

  difficultyCap: "very_easy" | "easy" | "moderate" | "hard";

}



function contract(

  condition: string,

  partial: Omit<ConditionOperationalContract, "condition" | "taskMin" | "taskMax">,

): ConditionOperationalContract {

  const limits = taskLimitsForCondition(condition);

  return {

    condition,

    taskMin: limits.min,

    taskMax: limits.max,

    ...partial,

  };

}



export const CONDITION_ENFORCEMENT_MATRIX: Record<string, ConditionOperationalContract> = {

  nothingness: contract("nothingness", {

    allowedOrderIntensity: "minimal",

    allowedProgression: "recovery_only",

    allowedAdaptation: "none",

    allowedExpansion: false,

    allowedOptimization: false,

    scalingAllowed: false,

    recoveryRequired: false,

    difficultyCap: "easy",

  }),

  danger: contract("danger", {

    allowedOrderIntensity: "minimal",

    allowedProgression: "frozen",

    allowedAdaptation: "stabilize",

    allowedExpansion: false,

    allowedOptimization: false,

    scalingAllowed: false,

    recoveryRequired: true,

    difficultyCap: "very_easy",

  }),

  urgency: contract("urgency", {

    allowedOrderIntensity: "low",

    allowedProgression: "controlled",

    allowedAdaptation: "stabilize",

    allowedExpansion: false,

    allowedOptimization: false,

    scalingAllowed: false,

    recoveryRequired: false,

    difficultyCap: "easy",

  }),

  stability: contract("stability", {

    allowedOrderIntensity: "normal",

    allowedProgression: "normal",

    allowedAdaptation: "feedback",

    allowedExpansion: true,

    allowedOptimization: false,

    scalingAllowed: true,

    recoveryRequired: false,

    difficultyCap: "moderate",

  }),

  power: contract("power", {

    allowedOrderIntensity: "high",

    allowedProgression: "accelerated",

    allowedAdaptation: "feedback",

    allowedExpansion: true,

    allowedOptimization: true,

    scalingAllowed: true,

    recoveryRequired: false,

    difficultyCap: "hard",

  }),

  affluence: contract("affluence", {

    allowedOrderIntensity: "high",

    allowedProgression: "accelerated",

    allowedAdaptation: "optimize",

    allowedExpansion: true,

    allowedOptimization: true,

    scalingAllowed: true,

    recoveryRequired: false,

    difficultyCap: "hard",

  }),

  power_change: contract("power_change", {

    allowedOrderIntensity: "low",

    allowedProgression: "controlled",

    allowedAdaptation: "stabilize",

    allowedExpansion: false,

    allowedOptimization: false,

    scalingAllowed: false,

    recoveryRequired: false,

    difficultyCap: "moderate",

  }),

};



export function getConditionContract(condition: string): ConditionOperationalContract {

  const key = condition.toLowerCase().replace(/\s+/g, "_");

  return CONDITION_ENFORCEMENT_MATRIX[key] ?? CONDITION_ENFORCEMENT_MATRIX.stability;

}


