import type { ModelCapability } from "../contracts/types.js";
import { DEFAULT_MODEL_CAPABILITIES, valueScore } from "../contracts/modelCatalog.js";

export class IntelligenceExchange {
  private models: ModelCapability[];

  constructor(models: ModelCapability[] = DEFAULT_MODEL_CAPABILITIES) {
    this.models = models.filter((m) => m.provider !== "rules");
  }

  list(): ModelCapability[] {
    return [...this.models];
  }

  rank(
    confidence: number,
    taskFit: { memory?: number; tool?: number; simulation?: number; provider?: string } = {},
  ): Array<ModelCapability & { valueScore: number }> {
    let candidates = this.models;
    if (taskFit.provider) {
      const preferred = candidates.filter((m) => m.provider === taskFit.provider);
      if (preferred.length > 0) candidates = preferred;
    }

    return candidates
      .map((m) => ({ ...m, valueScore: valueScore(m, confidence, taskFit) }))
      .sort((a, b) => b.valueScore - a.valueScore);
  }

  selectBest(
    confidence: number,
    taskFit: { memory?: number; tool?: number; simulation?: number; provider?: string } = {},
  ): ModelCapability & { valueScore: number } {
    const ranked = this.rank(confidence, taskFit);
    return ranked[0] ?? { ...DEFAULT_MODEL_CAPABILITIES[3]!, valueScore: 1 };
  }
}

export const intelligenceExchange = new IntelligenceExchange();
