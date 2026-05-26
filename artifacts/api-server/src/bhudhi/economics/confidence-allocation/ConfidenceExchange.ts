import type { ConfidenceTier } from "../contracts/types.js";

const TIERS: ConfidenceTier[] = [0.7, 0.8, 0.9, 0.95, 0.99];

export interface ConfidenceAllocation {
  tier: ConfidenceTier;
  costMultiplier: number;
  memoryMultiplier: number;
  validationSteps: number;
  agentCount: number;
  computeMultiplier: number;
}

/** Confidence must cost something — higher tiers consume more resources */
export class ConfidenceExchange {
  resolve(requested: number): ConfidenceAllocation {
    const tier = TIERS.reduce((best, t) =>
      Math.abs(t - requested) < Math.abs(best - requested) ? t : best,
    );

    const index = TIERS.indexOf(tier);
    return {
      tier,
      costMultiplier: 1 + index * 0.35,
      memoryMultiplier: 1 + index * 0.25,
      validationSteps: 1 + index,
      agentCount: 1 + Math.floor(index / 2),
      computeMultiplier: 1 + index * 0.4,
    };
  }
}

export const confidenceExchange = new ConfidenceExchange();
