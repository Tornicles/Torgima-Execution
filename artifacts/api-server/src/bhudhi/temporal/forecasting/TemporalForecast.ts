import type { ForecastBundle, TemporalInput } from "../contracts/types.js";

const HORIZONS = [1, 7, 30, 90, 365] as const;

export class TemporalForecast {
  forecast(input: TemporalInput, momentum: number): ForecastBundle {
    const horizons = HORIZONS.map((days) => {
      const delayRisk = days < 7 && momentum < 0.4 ? 0.6 : 0.2;
      const burnoutRisk = input.life?.burnout ? 0.5 : 0.15;
      const completion = Math.max(0, Math.min(1, momentum - delayRisk * 0.2));
      return {
        days,
        forecast: {
          delay: delayRisk,
          burnout: burnoutRisk,
          completion,
          opportunity: Math.min(1, momentum + 0.1),
        },
        confidence: Math.min(0.9, 0.45 + (365 - days) / 500),
      };
    });

    const adjustments: string[] = [];
    if (horizons[0]!.forecast.delay > 0.5) adjustments.push("Add buffer to near-term schedule");
    if (horizons[2]!.forecast.burnout > 0.4) adjustments.push("Reduce load over 30d horizon");

    return { horizons, adjustments };
  }
}

export const temporalForecast = new TemporalForecast();
