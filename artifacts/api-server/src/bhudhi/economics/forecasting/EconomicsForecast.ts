import type { EconomicsForecastPoint } from "../contracts/types.js";

const HORIZONS = [1, 7, 30, 90, 365] as const;

export class EconomicsForecast {
  predict(params: {
    dailyCostUsd: number;
    dailyRequests: number;
    dailyTokens: number;
    growthRate?: number;
  }): EconomicsForecastPoint[] {
    const growth = params.growthRate ?? 1.02;

    return HORIZONS.map((days) => {
      const factor = Math.pow(growth, days / 7);
      return {
        horizonDays: days,
        costUsd: params.dailyCostUsd * days * factor,
        tokens: Math.round(params.dailyTokens * days * factor),
        requests: Math.round(params.dailyRequests * days * factor),
        memoryMb: 50 * days * 0.1 * factor,
        simulationHours: 0.5 * days * 0.05 * factor,
        confidence: days <= 7 ? 0.85 : days <= 30 ? 0.75 : days <= 90 ? 0.65 : 0.55,
      };
    });
  }
}

export const economicsForecast = new EconomicsForecast();
