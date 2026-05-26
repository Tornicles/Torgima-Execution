import type { CivilizationInput, CivilEconomyResult, TrajectoryKind } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class CivilEconomy {
  track(input: CivilizationInput, seed: string): CivilEconomyResult {
    const production = seededUnit(seed, "prod") * 0.8 + 0.2;
    const distribution = seededUnit(seed, "dist");
    const scarcity = seededUnit(seed, "scarcity") * 0.4;
    const growth = production - scarcity * 0.3;
    const inefficiency = Math.max(0, 1 - distribution) * 0.5 + scarcity * 0.2;

    let economicTrajectory: TrajectoryKind = "stable";
    if (growth > 0.65) economicTrajectory = "growth";
    if (growth < 0.35) economicTrajectory = "decline";
    if (inefficiency > 0.6 && scarcity > 0.5) economicTrajectory = "collapse";

    return { economicTrajectory, production, inefficiency };
  }
}

export const civilEconomy = new CivilEconomy();
