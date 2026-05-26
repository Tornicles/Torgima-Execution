import type { ErectorInput, ScenarioKind, ScenarioResult } from "../contracts/types.js";
import { seededUnit } from "../lib/seededRandom.js";

const SCENARIOS: ScenarioKind[] = ["baseline", "optimistic", "realistic", "stress", "collapse"];

export class ScenarioEngine {
  generateAll(input: ErectorInput, seed: string): ScenarioResult[] {
    return SCENARIOS.map((scenario, i) => {
      const base = seededUnit(seed, `scenario-${scenario}`);
      let probability = 0.2;
      let risk = 0.3;
      if (scenario === "realistic") {
        probability = 0.35;
        risk = 0.35;
      } else if (scenario === "optimistic") {
        probability = 0.2;
        risk = 0.15;
      } else if (scenario === "stress") {
        probability = 0.15;
        risk = 0.65;
      } else if (scenario === "collapse") {
        probability = 0.05;
        risk = 0.95;
      } else {
        probability = 0.25;
        risk = 0.3 + base * 0.1;
      }
      void i;
      return { scenario, probability, risk };
    });
  }

  pick(input: ErectorInput, seed: string): ScenarioKind {
    return input.scenario ?? "realistic";
  }
}

export const scenarioEngine = new ScenarioEngine();
