import type { DecisionOption, ScenarioForecast } from "../contracts/types.js";

const HORIZONS = [1, 7, 30, 90, 365] as const;

export class DecisionForecastEngine {
  forecast(option: DecisionOption, seed = 1): ScenarioForecast[] {
    return HORIZONS.map((days) => {
      const growth = 1 + days / 365;
      const base = option.expectedValue ?? option.confidence * 100;
      const best = base * growth * 1.3;
      const expected = base * growth;
      const worst = base * growth * (1 - option.risk * 0.8);

      return {
        horizonDays: days,
        bestOutcome: best,
        expectedOutcome: expected,
        worstOutcome: worst,
        probabilities: {
          best: Math.min(0.25, 0.1 + seed * 0.02),
          expected: 0.55,
          worst: Math.min(0.35, option.risk * 0.4),
        },
        scenarioTree: [
          { branch: `${option.optionType}_success`, probability: option.confidence },
          { branch: `${option.optionType}_neutral`, probability: 0.25 },
          { branch: `${option.optionType}_failure`, probability: option.risk * 0.5 },
        ],
      };
    });
  }
}

export const decisionForecastEngine = new DecisionForecastEngine();
