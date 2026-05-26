import type { CivilizationInput, PopulationResult } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class PopulationEngine {
  track(input: CivilizationInput, seed: string): PopulationResult {
    const teamCount = input.teams?.length ?? 1;
    const orgCount = input.organizations?.length ?? 1;
    const growth = seededUnit(seed, "pop-growth") * 0.15;
    const trust = 0.5 + seededUnit(seed, "trust") * 0.35;
    const participation = Math.min(1, teamCount / 5 + 0.3);
    const capacity = Math.min(1, orgCount / 3 + 0.25);
    const populationHealth = Math.min(1, (trust + participation + capacity) / 3 - growth * 0.2);

    return {
      populationHealth,
      distribution: {
        growth,
        mobility: seededUnit(seed, "mobility") * 0.5,
        participation,
        trust,
        capacity,
      },
    };
  }
}

export const populationEngine = new PopulationEngine();
