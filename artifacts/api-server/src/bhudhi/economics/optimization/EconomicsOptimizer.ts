import type { EconomicsObservatoryMetrics } from "../contracts/types.js";

export interface OptimizationProposal {
  id: string;
  type: "routing" | "cache" | "compression" | "model_downgrade" | "waste";
  description: string;
  estimatedSavingsUsd: number;
  requiresGovernance: boolean;
}

export class EconomicsOptimizer {
  detectWaste(metrics: EconomicsObservatoryMetrics): OptimizationProposal[] {
    const proposals: OptimizationProposal[] = [];

    if (metrics.wasteScore > 0.3) {
      proposals.push({
        id: "waste-dedup",
        type: "waste",
        description: "Deduplicate prompts and memory retrieval",
        estimatedSavingsUsd: metrics.costPerRequest * 0.15,
        requiresGovernance: false,
      });
    }

    if (metrics.cacheHitRate < 0.2) {
      proposals.push({
        id: "cache-expand",
        type: "cache",
        description: "Expand response cache for simple triggers",
        estimatedSavingsUsd: metrics.costPerUser * 0.1,
        requiresGovernance: false,
      });
    }

    if (metrics.avgValueScore < 50) {
      proposals.push({
        id: "model-rerank",
        type: "routing",
        description: "Shift routing to higher value-score models",
        estimatedSavingsUsd: metrics.costPerRequest * 0.08,
        requiresGovernance: true,
      });
    }

    return proposals;
  }
}

export const economicsOptimizer = new EconomicsOptimizer();
