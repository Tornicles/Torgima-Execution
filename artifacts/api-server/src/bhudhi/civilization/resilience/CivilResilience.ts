import type { ResilienceResult } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class CivilResilience {
  measure(
    seed: string,
    ecosystemHealth: number,
    institutionEffectiveness: number,
    populationHealth: number,
  ): ResilienceResult {
    const shockResistance = seededUnit(seed, "shock") * 0.5 + ecosystemHealth * 0.3;
    const adaptation = institutionEffectiveness * 0.6 + populationHealth * 0.2;
    const recovery = seededUnit(seed, "recovery") * 0.4 + adaptation * 0.4;
    const continuity = (shockResistance + recovery) / 2;
    const resilienceScore = Math.round(
      Math.min(100, Math.max(0, (shockResistance + adaptation + recovery + continuity) * 25)),
    );

    const stressTests = [
      { name: "Population collapse", impact: -0.3 },
      { name: "Economic recession", impact: -0.25 },
      { name: "Ecosystem collapse", impact: -0.4 },
      { name: "Institution failure", impact: -0.2 },
      { name: "Resource scarcity", impact: -0.3 },
    ];

    return {
      resilienceScore,
      recoveryProfile: {
        shockResistance,
        adaptation,
        recovery,
        continuity,
      },
      stressTests,
      recoveryTimeYears: Math.floor(100 * (1 - resilienceScore / 100)),
      antifragilityScore: resilienceScore > 70 ? 0.6 : 0.3,
    };
  }
}

export const civilResilience = new CivilResilience();
