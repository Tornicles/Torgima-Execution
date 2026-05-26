import type { DiscoveredCapability, EvaluationResult, ExpansionInput } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class ExpansionEvaluation {
  measure(input: ExpansionInput, candidates: DiscoveredCapability[], seed: string): EvaluationResult {
    const avgScore = candidates.length
      ? candidates.reduce((s, c) => s + c.score, 0) / candidates.length
      : 0.3;
    const performance = avgScore;
    const risk = seededUnit(seed, "risk") * 0.5 + (input.execution?.highRisk ? 0.3 : 0.1);
    const reliability = 1 - risk * 0.6;
    const cost = seededUnit(seed, "cost") * 0.4;
    const drift = seededUnit(seed, "drift") * 0.3;

    let action: EvaluationResult["action"] = "repeat";
    if (performance > 0.7 && risk < 0.4 && reliability > 0.6) action = "promote";
    if (risk > 0.75) action = "reject";
    if (drift > 0.65) action = "rollback";

    return { performance, risk, reliability, cost, drift, action };
  }
}

export const expansionEvaluation = new ExpansionEvaluation();
