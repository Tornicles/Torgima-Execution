import type { DecisionOption, ExpectedValueResult } from "../contracts/types.js";

export class ExpectedValueEngine {
  evaluate(option: DecisionOption, alternatives: DecisionOption[]): ExpectedValueResult {
    const probability = option.confidence;
    const outcome = option.expectedValue ?? option.confidence * 100;
    const expectedValue = probability * outcome;

    const failureCost = option.risk * outcome * 0.5;
    const upside = outcome * (1 - option.risk);
    const downside = failureCost;

    const altEv = alternatives
      .filter((a) => a.id !== option.id)
      .map((a) => (a.confidence * (a.expectedValue ?? a.confidence * 100)));
    const bestAlt = altEv.length > 0 ? Math.max(...altEv) : 0;
    const regret = Math.max(0, bestAlt - expectedValue);

    let recommendation = "Proceed — positive expected value";
    if (expectedValue < failureCost) recommendation = "Reject — expected value below failure cost";
    else if (regret > expectedValue * 0.3) recommendation = "Reconsider — significant regret vs alternatives";

    return { expectedValue, regret, upside, downside, recommendation };
  }

  scoreOptions(options: DecisionOption[]): DecisionOption[] {
    return options
      .map((o) => {
        const ev = o.confidence * (o.expectedValue ?? o.confidence * 100);
        const riskPenalty = o.risk * 30;
        const score = ev - riskPenalty + (o.optionType === "balanced" ? 5 : 0);
        return { ...o, expectedValue: score };
      })
      .sort((a, b) => (b.expectedValue ?? 0) - (a.expectedValue ?? 0));
  }
}

export const expectedValueEngine = new ExpectedValueEngine();
