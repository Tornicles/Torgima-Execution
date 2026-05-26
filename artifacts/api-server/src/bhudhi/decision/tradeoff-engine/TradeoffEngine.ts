import type { DecisionOption, TradeoffMatrix } from "../contracts/types.js";

export class TradeoffEngine {
  evaluate(option: DecisionOption): TradeoffMatrix {
    const time = 1 / Math.max(option.timeline, 1);
    const money = 1 / Math.max(option.cost, 1);
    const complexity = option.optionType === "experimental" ? 0.8 : option.optionType === "conservative" ? 0.3 : 0.5;
    const lifeImpact = option.optionType === "aggressive" ? 0.85 : 0.55;
    const confidence = option.confidence;
    const executionEffort = option.optionType === "aggressive" ? 0.9 : 0.5;
    const risk = option.risk;
    const learningValue = option.optionType === "experimental" ? 0.9 : 0.4;

    const chains: string[] = [];
    if (time > 0.15) chains.push("Fast");
    if (risk > 0.6) chains.push("Risky");
    if (money > 0.01) chains.push("Cheap");
    if (confidence < 0.7) chains.push("Lower confidence");

    return {
      time,
      money,
      complexity,
      lifeImpact,
      confidence,
      executionEffort,
      risk,
      learningValue,
      summary: chains.length > 0 ? chains.join(" → ") : "Balanced tradeoffs",
    };
  }

  matrixForAll(options: DecisionOption[]): Record<string, TradeoffMatrix> {
    const out: Record<string, TradeoffMatrix> = {};
    for (const o of options) {
      out[o.id] = this.evaluate(o);
    }
    return out;
  }
}

export const tradeoffEngine = new TradeoffEngine();
