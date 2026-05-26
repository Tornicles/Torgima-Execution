import type { SimulationOutcomes } from "../contracts/types.js";
import type { EconomicResult } from "../contracts/types.js";
import type { ScenarioKind } from "../contracts/types.js";
import type { SimulationScoreResult } from "../contracts/types.js";

export class SimulationScore {
  measure(
    outcomes: SimulationOutcomes,
    economy: EconomicResult,
    scenario: ScenarioKind,
  ): SimulationScoreResult {
    const survival = outcomes.survived ? (scenario === "stress" ? 70 : 85) : 15;
    const goalAchievement = Math.round(outcomes.survived ? economy.economicHealth * 100 : 20);
    const efficiency = Math.round((1 - outcomes.pressure) * 80);
    const resilience = scenario === "collapse" ? 10 : Math.round((1 - outcomes.pressure) * 70);
    const risk = Math.round(outcomes.pressure * 100);
    const overall = Math.round((survival + goalAchievement + efficiency + resilience - risk * 0.3) / 4);
    const confidence = Math.min(0.95, 0.5 + (outcomes.events.length / 10) * 0.2 + (outcomes.survived ? 0.2 : 0));

    return {
      survival: Math.min(100, Math.max(0, survival)),
      goalAchievement,
      efficiency,
      resilience,
      risk,
      overall: Math.min(100, Math.max(0, overall)),
      confidence,
    };
  }
}

export const simulationScore = new SimulationScore();
