import type { ErectorInput } from "../contracts/types.js";
import { seededUnit } from "../lib/seededRandom.js";

export class EnvironmentEngine {
  initial(input: ErectorInput, seed: string, volatility: number): Record<string, unknown> {
    return {
      time: input.time?.horizonDays ?? 30,
      market: input.world?.market ?? "neutral",
      events: [],
      constraints: input.constraints ?? [],
      randomness: volatility,
      tick: 0,
    };
  }

  evolve(env: Record<string, unknown>, seed: string, tick: number): Record<string, unknown> {
    const shock = seededUnit(seed, `shock-${tick}`);
    if (shock > 0.85) {
      return { ...env, events: [...((env.events as unknown[]) ?? []), { type: "shock", tick }], tick };
    }
    if (shock < 0.15) {
      return { ...env, stabilized: true, tick };
    }
    return { ...env, tick };
  }
}

export const environmentEngine = new EnvironmentEngine();
