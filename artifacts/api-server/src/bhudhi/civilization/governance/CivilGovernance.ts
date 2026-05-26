import type { CivilizationInput, GovernanceObserveResult } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class CivilGovernance {
  observe(input: CivilizationInput, seed: string): GovernanceObserveResult {
    const coordination = seededUnit(seed, "gov-coord");
    const efficiency = seededUnit(seed, "gov-eff");
    const transparency = seededUnit(seed, "gov-trans");
    const resilience = (coordination + efficiency + transparency) / 3;

    let action: GovernanceObserveResult["action"] = "measure";
    if (resilience < 0.4) action = "stress";
    else if (resilience > 0.7) action = "recommend";
    else action = "compare";

    return { coordination, efficiency, transparency, resilience, action };
  }
}

export const civilGovernance = new CivilGovernance();
