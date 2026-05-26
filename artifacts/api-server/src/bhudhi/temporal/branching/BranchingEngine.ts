import type { BranchResult, TemporalInput } from "../contracts/types.js";

export class BranchingEngine {
  evaluate(input: TemporalInput): BranchResult {
    const goal = input.goal ?? "goal";
    const alternatives = [
      { path: "Path A — act now", cost: 0.6, risk: 0.4, timeDays: 3, regret: 0.2 },
      { path: "Path B — defer 7d", cost: 0.3, risk: 0.25, timeDays: 10, regret: 0.45 },
      { path: "Path C — parallel track", cost: 0.8, risk: 0.55, timeDays: 5, regret: 0.35 },
      { path: "Fallback — minimal viable", cost: 0.2, risk: 0.15, timeDays: 14, regret: 0.5 },
    ];

    const momentum =
      typeof input.execution?.velocity === "number" ? input.execution.velocity : 0.5;
    const recommended =
      momentum > 0.65 ? alternatives[0]! : input.life?.burnout ? alternatives[3]! : alternatives[1]!;

    return {
      recommendedPath: `${recommended.path} for ${goal}`,
      alternatives,
    };
  }
}

export const branchingEngine = new BranchingEngine();
