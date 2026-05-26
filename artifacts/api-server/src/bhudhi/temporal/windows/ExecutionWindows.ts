import type { TemporalInput, WindowClass, WindowResult } from "../contracts/types.js";

export class ExecutionWindows {
  generate(input: TemporalInput, momentumRisk: number): {
    best: WindowResult;
    acceptable: WindowResult;
    avoid: WindowResult;
    primary: WindowResult;
  } {
    const energy =
      typeof input.life?.energyLevel === "number" ? input.life.energyLevel : 0.55;
    const hour = new Date().getHours();
    const isWorkHours = hour >= 9 && hour <= 17;

    let primaryClass: WindowClass = "acceptable";
    let successProbability = 0.55;

    if (energy > 0.65 && isWorkHours && momentumRisk < 0.4) {
      primaryClass = "best";
      successProbability = 0.82;
    } else if (energy < 0.35 || momentumRisk > 0.7) {
      primaryClass = "avoid";
      successProbability = 0.25;
    }

    const expiresAt = new Date(Date.now() + 3 * 86400000).toISOString();

    const best: WindowResult = {
      window: "best",
      label: "High energy + aligned context",
      successProbability: 0.85,
      score: 85,
      expiresAt,
    };
    const acceptable: WindowResult = {
      window: "acceptable",
      label: "Proceed with buffer",
      successProbability: 0.6,
      score: 60,
    };
    const avoid: WindowResult = {
      window: "avoid",
      label: "Low energy or high fatigue risk",
      successProbability: 0.2,
      score: 20,
    };

    const primary =
      primaryClass === "best" ? best : primaryClass === "avoid" ? avoid : acceptable;

    return { best, acceptable, avoid, primary };
  }
}

export const executionWindows = new ExecutionWindows();
