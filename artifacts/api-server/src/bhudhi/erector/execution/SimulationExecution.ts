import type { Actor, EconomicResult, SimulationOutcomes } from "../contracts/types.js";
import type { ScenarioKind } from "../contracts/types.js";
import { seededUnit } from "../lib/seededRandom.js";

export class SimulationExecution {
  run(
    goal: string,
    actors: Actor[],
    economy: EconomicResult,
    scenario: ScenarioKind,
    institutionPressure: number,
    seed: string,
    ticks = 5,
  ): SimulationOutcomes {
    const events: SimulationOutcomes["events"] = [];
    const history: string[] = [`Goal: ${goal}`, `Scenario: ${scenario}`];

    for (let t = 0; t < ticks; t++) {
      const r = seededUnit(seed, `tick-${t}`);
      if (r > 0.7) {
        events.push({ at: t, type: "order_executed", detail: "Plan step completed" });
      } else if (r < 0.2) {
        events.push({ at: t, type: "blocker", detail: "Dependency delayed" });
      }
    }

    const pressure = Math.min(
      1,
      (1 - economy.economicHealth) * 0.4 + institutionPressure * 0.3 + (scenario === "collapse" ? 0.5 : 0),
    );
    const survived = scenario !== "collapse" && economy.economicHealth > 0.25 && pressure < 0.85;

    if (!survived) history.push("Simulation: pressure exceeded survival threshold");
    else history.push("Simulation: goal path viable under pressure");

    return { events, history, pressure, survived };
  }
}

export const simulationExecution = new SimulationExecution();
