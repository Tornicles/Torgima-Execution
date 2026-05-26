import type { CivilizationInput, InstitutionResult } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class CivilInstitutionEngine {
  simulate(input: CivilizationInput, seed: string): InstitutionResult {
    const rules = seededUnit(seed, "rules");
    const approval = seededUnit(seed, "approval");
    const competition = seededUnit(seed, "competition") * 0.4;
    const adaptation = seededUnit(seed, "adapt");
    const coordination = (rules + approval + adaptation) / 3;
    const institutionEffectiveness = Math.min(1, coordination - competition * 0.3);

    return {
      institutionEffectiveness,
      coordination,
      adaptation,
    };
  }
}

export const civilInstitutionEngine = new CivilInstitutionEngine();
