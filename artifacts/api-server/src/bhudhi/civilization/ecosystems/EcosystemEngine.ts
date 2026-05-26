import type { CivilizationInput, EcosystemResult } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class EcosystemEngine {
  model(input: CivilizationInput, seed: string): EcosystemResult {
    const cooperation = seededUnit(seed, "coop");
    const competition = seededUnit(seed, "comp") * 0.6;
    const exchange = seededUnit(seed, "exchange");
    const dependency = seededUnit(seed, "dep") * 0.5;
    const resilience = cooperation * 0.4 + exchange * 0.35 + (1 - dependency) * 0.25;
    const ecosystemHealth = Math.min(1, resilience);
    const systemRisk = Math.min(1, competition + dependency * 0.5);

    return { ecosystemHealth, systemRisk };
  }
}

export const ecosystemEngine = new EcosystemEngine();
