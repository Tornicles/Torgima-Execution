import {
  structureGoalDeterministic,
  structureGoalWithBhudhi,
} from "../ValidationEngine.js";
import type { StructuredGoalDraft } from "../../../types/validation.js";

export async function refineGoalWithIIS(params: {
  userId: string;
  aiEnabled: boolean;
  input: {
    rawGoal: string;
    purpose?: string;
    timeframe?: string;
    commitmentLevel?: string;
    currentContext?: string;
    successSignal?: string;
    knownBlockers?: string;
  };
}): Promise<StructuredGoalDraft> {
  if (params.aiEnabled) {
    return structureGoalWithBhudhi({ ...params.input, userId: params.userId });
  }
  return structureGoalDeterministic(params.input);
}

export function isGoalMeasurable(goal: string): boolean {
  return /\d+/.test(goal) || /percent|%|revenue|users|customers|mrr|arr|within\s+\d+/i.test(goal);
}
