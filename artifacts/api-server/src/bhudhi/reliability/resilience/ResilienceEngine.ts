import type { DetectedIncident, ReliabilityInput } from "../contracts/types.js";

export interface ResilienceMetrics {
  uptime: number;
  degradation: number;
  stress: number;
  adaptation: number;
  stability: number;
  score: number;
}

export class ResilienceEngine {
  score(input: ReliabilityInput, incidents: DetectedIncident[]): ResilienceMetrics {
    const uptime =
      typeof input.execution?.uptime === "number" ? input.execution.uptime : 0.99;
    const degradation = incidents.filter((i) => i.severity !== "INFO").length * 0.08;
    const stress =
      typeof input.world?.stress === "number"
        ? input.world.stress
        : typeof input.execution?.errorRate === "number"
          ? input.execution.errorRate
          : 0.2;
    const adaptation = input.execution?.recovered === true ? 0.85 : 0.6;
    const stability = Math.max(0, 1 - degradation - stress * 0.3);

    const raw =
      uptime * 30 + (1 - degradation) * 25 + (1 - stress) * 20 + adaptation * 15 + stability * 10;
    const score = Math.min(100, Math.max(0, Math.round(raw)));

    return { uptime, degradation, stress, adaptation, stability, score };
  }
}

export const resilienceEngine = new ResilienceEngine();
