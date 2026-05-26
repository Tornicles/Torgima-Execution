import type { CivilizationInput, EvolutionResult, EvolutionMode } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class EvolutionEngine {
  track(input: CivilizationInput, seed: string, health: number): EvolutionResult {
    const adaptation = seededUnit(seed, "adapt-ev");
    const selection = seededUnit(seed, "select");
    const innovation = seededUnit(seed, "innov");
    const survival = Math.min(1, (adaptation + selection + health) / 3);

    let mode: EvolutionMode = "stable";
    if (survival > 0.7 && innovation > 0.6) mode = "expanding";
    else if (survival < 0.35) mode = "collapsing";
    else if (survival < 0.55 || innovation < 0.35) mode = "fragile";

    return { mode, adaptation, selection, innovation, survival };
  }
}

export const evolutionEngine = new EvolutionEngine();
