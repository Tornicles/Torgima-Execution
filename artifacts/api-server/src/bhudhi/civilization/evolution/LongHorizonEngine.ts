import type {
  InflectionPoint,
  LongHorizonResult,
  TrajectoryKind,
  YearSimulationPoint,
} from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

const HORIZONS = [1, 5, 10, 25, 100] as const;

export class LongHorizonEngine {
  forecast(seed: string, baseTrajectory: TrajectoryKind, resilience: number): LongHorizonResult {
    const horizons = HORIZONS.map((horizonYears) => {
      const drift = seededUnit(seed, `horizon-${horizonYears}`);
      let trajectory: TrajectoryKind = baseTrajectory;
      if (horizonYears >= 25 && resilience < 0.4) trajectory = "decline";
      if (horizonYears >= 10 && drift > 0.75 && resilience > 0.6) trajectory = "compound";
      if (horizonYears >= 100 && drift < 0.2) trajectory = "stable";

      const confidence = Math.max(0.15, Math.min(0.85, 0.7 - horizonYears * 0.005 + resilience * 0.2));

      return { horizonYears, trajectory, confidence };
    });

    const primary = horizons.find((h) => h.horizonYears === 10) ?? horizons[2];
    return {
      horizons,
      trajectory: primary.trajectory,
      confidence: primary.confidence,
    };
  }

  /** Detect trajectory shifts across a multi-year simulation series. */
  findInflectionPoints(series: YearSimulationPoint[]): InflectionPoint[] {
    const points: InflectionPoint[] = [];
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1];
      const curr = series[i];
      if (curr.trajectory !== prev.trajectory) {
        points.push({
          year: curr.year,
          from: prev.trajectory,
          to: curr.trajectory,
        });
      }
    }
    return points;
  }
}

export const longHorizonEngine = new LongHorizonEngine();
