import type { MeasurementResult } from "../contracts/types.js";

export class MeasurementEngine {
  measure(
    controlMetric: number,
    variantMetric: number,
    sampleSize: number,
  ): MeasurementResult {
    const delta = variantMetric - controlMetric;
    const pooled = Math.max(0.01, (Math.abs(controlMetric) + Math.abs(variantMetric)) / 2);
    const effectSize = delta / pooled;
    const confidence = Math.min(0.99, 0.5 + Math.min(1, sampleSize / 200) * 0.4 + Math.abs(effectSize) * 0.1);

    return {
      delta,
      confidence,
      effectSize,
      impact: delta,
      quality: Math.max(0, 0.5 + effectSize * 0.2),
      speed: Math.max(0, 0.5 + delta * 0.15),
    };
  }
}

export const measurementEngine = new MeasurementEngine();
