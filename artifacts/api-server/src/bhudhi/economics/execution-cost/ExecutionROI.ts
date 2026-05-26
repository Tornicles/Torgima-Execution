import type { EconomicsTaskInput, RoiAction } from "../contracts/types.js";

export interface RoiResult {
  action: RoiAction;
  score: number;
  reasoning: string;
  outcomeValue: number;
  totalCost: number;
}

export class ExecutionROI {
  evaluate(
    input: EconomicsTaskInput,
    estimatedCostUsd: number,
    expectedBenefit = 1,
  ): RoiResult {
    const compute = estimatedCostUsd;
    const execution = input.simulation ? 0.02 : 0.005;
    const humanEnergy = input.priority === "critical" ? 0.15 : 0.05;
    const time = (input.deadlineMs ?? 5000) / 1_000_000;
    const riskPenalty = (input.risk ?? 0.2) * 0.5;

    const totalCost = compute + execution + humanEnergy + time + riskPenalty;
    const outcomeValue = expectedBenefit * (input.confidence ?? 0.7);
    const score = totalCost > 0 ? outcomeValue / totalCost : 0;

    let action: RoiAction = "execute";
    let reasoning = "Positive ROI — proceed with cheapest safe path";

    if (input.unsafe || score < 0.5) {
      action = "cancel";
      reasoning = "ROI too low or unsafe — block execution";
    } else if (score < 1) {
      action = "simulate";
      reasoning = "Marginal ROI — simulate before execute";
    } else if (input.budgetUsd && totalCost > input.budgetUsd) {
      action = "delay";
      reasoning = "Exceeds budget — delay until funds available";
    } else if (score < 2 && input.priority !== "critical") {
      action = "simplify";
      reasoning = "Moderate ROI — simplify task scope";
    }

    return { action, score, reasoning, outcomeValue, totalCost };
  }
}

export const executionRoi = new ExecutionROI();
