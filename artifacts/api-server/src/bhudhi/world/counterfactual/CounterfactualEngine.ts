import type { CounterfactualScenario } from "../contracts/types.js";

export class CounterfactualEngine {
  generate(scenario: string, baseConfidence = 0.5): CounterfactualScenario[] {
    return [
      {
        scenario: `What if: ${scenario} (optimistic)`,
        probability: Math.min(0.9, baseConfidence + 0.15),
        impact: 0.7,
      },
      {
        scenario: `What if: ${scenario} (baseline)`,
        probability: baseConfidence,
        impact: 0.5,
      },
      {
        scenario: `What if: ${scenario} (pessimistic)`,
        probability: Math.max(0.1, baseConfidence - 0.2),
        impact: 0.85,
      },
    ];
  }

  branch(scenario: string): { whatWouldHappen: string; whatShouldHappen: string } {
    const alts = this.generate(scenario);
    const best = alts[0]!;
    const worst = alts[2]!;
    return {
      whatWouldHappen: `${best.scenario} (p=${best.probability.toFixed(2)})`,
      whatShouldHappen: `${alts[1]!.scenario} — balanced path`,
    };
  }
}

export const counterfactualEngine = new CounterfactualEngine();
