import type { DecisionInput, DecisionOption, DecisionOptionType } from "../contracts/types.js";

const OPTION_TEMPLATES: Array<{
  type: DecisionOptionType;
  label: string;
  costMul: number;
  timelineMul: number;
  riskMul: number;
  confMul: number;
}> = [
  { type: "conservative", label: "Conservative", costMul: 0.7, timelineMul: 1.4, riskMul: 0.3, confMul: 0.9 },
  { type: "balanced", label: "Balanced", costMul: 1, timelineMul: 1, riskMul: 0.5, confMul: 0.8 },
  { type: "aggressive", label: "Aggressive", costMul: 1.3, timelineMul: 0.6, riskMul: 0.75, confMul: 0.65 },
  { type: "experimental", label: "Experimental", costMul: 0.9, timelineMul: 0.8, riskMul: 0.6, confMul: 0.55 },
  { type: "counterfactual", label: "Counterfactual", costMul: 0.5, timelineMul: 2, riskMul: 0.4, confMul: 0.5 },
];

export class OptionGenerator {
  generate(input: DecisionInput): DecisionOption[] {
    const baseCost = typeof input.context?.estimatedCost === "number" ? input.context.estimatedCost : 1000;
    const baseTimeline =
      typeof input.context?.timelineDays === "number" ? input.context.timelineDays : 14;
    const baseConf = input.signals?.confidence ?? 0.7;

    const options = OPTION_TEMPLATES.map((t, i) => {
      const id = `opt_${t.type}_${i}`;
      return {
        id,
        option: `${t.label}: ${input.goal.slice(0, 80)}`,
        optionType: t.type,
        description: `${t.label} path for "${input.goal}" under ${input.trigger}`,
        cost: Math.round(baseCost * t.costMul),
        timeline: Math.max(1, Math.round(baseTimeline * t.timelineMul)),
        risk: Math.min(0.95, t.riskMul * (input.signals?.global === "danger" ? 1.2 : 1)),
        confidence: Math.min(0.99, baseConf * t.confMul),
      };
    });

    if (options.length < 5) {
      options.push({
        id: "opt_defer",
        option: "Defer decision",
        optionType: "counterfactual",
        description: "Wait for more signal clarity before committing",
        cost: 0,
        timeline: 7,
        risk: 0.2,
        confidence: 0.6,
      });
    }

    return options;
  }
}

export const optionGenerator = new OptionGenerator();
