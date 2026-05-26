import type { CausalResult, ComparisonResult, MeasurementResult } from "../contracts/types.js";

export class CausalExperimentEngine {
  analyze(
    comparison: ComparisonResult,
    control: MeasurementResult,
    winner?: MeasurementResult,
  ): CausalResult {
    const causes: string[] = [];
    if (comparison.winner) {
      causes.push(`Variant ${comparison.winner} produced measurable delta`);
    }
    if (winner && winner.effectSize > 0.1) {
      causes.push(`Effect size ${winner.effectSize.toFixed(2)} suggests causal lift`);
    } else {
      causes.push("Effect size too small — correlation cannot graduate");
    }

    const confidence = winner?.confidence ?? control.confidence;
    const replicability =
      comparison.verdict === "winner" && (winner?.confidence ?? 0) > 0.75 ? 0.7 : 0.35;

    return { causes, confidence, replicability };
  }
}

export const causalExperimentEngine = new CausalExperimentEngine();
