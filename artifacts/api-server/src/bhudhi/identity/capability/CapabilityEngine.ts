import type { CapabilityResult, IdentityInput } from "../contracts/types.js";

const DIMENSIONS = ["knowledge", "discipline", "creativity", "execution", "resilience"] as const;

export class CapabilityEngine {
  score(input: IdentityInput): CapabilityResult {
    const dimensions: CapabilityResult["dimensions"] = {};
    let total = 0;

    for (const d of DIMENSIONS) {
      const current = this.currentScore(d, input);
      const potential = Math.min(1, current + 0.25);
      const velocity = this.velocity(d, input);
      dimensions[d] = { current, potential, velocity };
      total += current;
    }

    const capabilityScore = total / DIMENSIONS.length;
    const velocities = Object.values(dimensions).map((x) => x.velocity);
    const growthRate = velocities.reduce((a, b) => a + b, 0) / velocities.length;

    return {
      capabilityScore,
      ceiling: Math.min(1, capabilityScore + 0.3),
      growthRate,
      dimensions,
    };
  }

  private currentScore(dim: string, input: IdentityInput): number {
    const base = 0.5;
    if (dim === "execution" && input.execution?.status === "completed") return 0.75;
    if (dim === "resilience" && input.feedback?.recovered) return 0.7;
    if (dim === "knowledge" && input.memory) return 0.65;
    if (dim === "discipline" && input.history?.streak) return 0.68;
    if (dim === "creativity" && input.feedback?.novel) return 0.72;
    return base;
  }

  private velocity(dim: string, input: IdentityInput): number {
    if (input.feedback?.improving && dim === "execution") return 0.15;
    if (input.feedback?.burnout && dim === "resilience") return -0.1;
    return 0.05;
  }
}

export const capabilityEngine = new CapabilityEngine();
