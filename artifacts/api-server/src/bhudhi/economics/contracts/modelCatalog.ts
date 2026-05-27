import type { ModelCapability } from "./types.js";

/** Default intelligence marketplace assets (seeded to DB) */
export const DEFAULT_MODEL_CAPABILITIES: ModelCapability[] = [
  {
    modelId: "claude-sonnet-4-20250514",
    provider: "claude",
    costPerMillion: 3.0,
    latencyMs: 4500,
    quality: 0.92,
    reliability: 0.9,
    risk: 0.15,
    memoryFit: 0.85,
    toolFit: 0.7,
    simulationFit: 0.6,
  },
  {
    modelId: "rules-fallback",
    provider: "rules",
    costPerMillion: 0.01,
    latencyMs: 50,
    quality: 0.55,
    reliability: 0.99,
    risk: 0.05,
    memoryFit: 0.4,
    toolFit: 0.2,
    simulationFit: 0.3,
  },
];

export function valueScore(
  model: ModelCapability,
  confidence: number,
  taskFit: { memory?: number; tool?: number; simulation?: number } = {},
): number {
  const fit =
    (taskFit.memory ?? model.memoryFit) *
    (taskFit.tool ?? model.toolFit) *
    (taskFit.simulation ?? model.simulationFit);
  const numerator = model.quality * model.reliability * confidence * fit;
  const latencyNorm = Math.max(model.latencyMs / 1000, 0.5);
  const denominator = Math.max(model.costPerMillion * 0.001, 0.0001) * latencyNorm;
  return numerator / denominator;
}
