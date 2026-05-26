import type { Actor, EconomicResult, ScenarioKind } from "../contracts/types.js";
import { seededUnit } from "../lib/seededRandom.js";

export class SimulationEconomy {
  simulate(actors: Actor[], scenario: ScenarioKind, seed: string): EconomicResult {
    const spend = actors.reduce((s, a) => s + (a.resources.budget ?? a.resources.compute ?? 5), 0);
    const pressure = scenario === "collapse" ? 0.9 : scenario === "stress" ? 0.7 : seededUnit(seed, "econ");
    const economicHealth = Math.max(0, 1 - pressure - spend / 200);
    let trajectory: EconomicResult["trajectory"] = "stable";
    if (economicHealth > 0.65) trajectory = "growth";
    if (economicHealth < 0.35) trajectory = "decline";
    return { economicHealth, risk: pressure, trajectory };
  }
}

export const simulationEconomy = new SimulationEconomy();
