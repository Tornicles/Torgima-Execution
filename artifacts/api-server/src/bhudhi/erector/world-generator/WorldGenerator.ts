import type { ErectorInput, GeneratedWorld, WorldMode } from "../contracts/types.js";
import { seededUnit } from "../lib/seededRandom.js";

export class WorldGenerator {
  generate(input: ErectorInput, seed: string): {
    world: GeneratedWorld;
    realism: number;
    difficulty: number;
    volatility: number;
    mode: WorldMode;
  } {
    const mode = input.mode ?? "STANDARD";
    const realism = mode === "REALITY" ? 0.9 : mode === "FAST" ? 0.5 : 0.7;
    const difficulty =
      mode === "STRATEGIC" ? 0.75 : mode === "FAST" ? 0.35 : seededUnit(seed, "difficulty") * 0.5 + 0.35;
    const volatility =
      typeof input.world?.volatility === "number"
        ? input.world.volatility
        : seededUnit(seed, "volatility") * 0.6 + 0.2;

    const world: GeneratedWorld = {
      market: {
        size: Math.round(seededUnit(seed, "market") * 1000),
        growth: seededUnit(seed, "growth") * 0.2 - 0.05,
        competition: volatility,
      },
      organization: {
        teams: Math.max(1, Math.round(seededUnit(seed, "teams") * 5)),
        capacity: 1 - difficulty * 0.3,
      },
      individuals: [
        { id: "lead", role: "owner", motivation: seededUnit(seed, "mot") },
        { id: "agent-1", role: "assistant", isAgent: true },
      ],
      systems: [{ id: "execution", load: difficulty }, { id: "governance", strict: realism > 0.7 }],
      events: [{ type: "launch", tick: 0 }],
      resources: {
        budget: Math.round((1 - difficulty) * 100),
        time: Math.round(seededUnit(seed, "time") * 90),
      },
    };

    return { world, realism, difficulty, volatility, mode };
  }
}

export const worldGenerator = new WorldGenerator();
