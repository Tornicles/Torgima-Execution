import type { BenchmarkResult, DiscoveredCapability, EvaluationResult } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class BenchmarkEngine {
  compare(
    seed: string,
    candidates: DiscoveredCapability[],
    evaluation: EvaluationResult,
    previousGain = 0,
  ): BenchmarkResult | null {
    if (candidates.length === 0) return null;

    const current = evaluation.performance;
    const gain = Math.max(0, current - previousGain);
    const cost = evaluation.cost;
    const confidence = Math.min(0.9, seededUnit(seed, "bench") * 0.4 + evaluation.reliability * 0.5);

    return { gain, cost, confidence };
  }
}

export const benchmarkEngine = new BenchmarkEngine();
