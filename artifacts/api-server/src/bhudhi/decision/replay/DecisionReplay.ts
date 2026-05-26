import type { DecisionOption, DecisionResult } from "../contracts/types.js";

export interface ReplayResult {
  whatHappened: string;
  whatShouldHappen: string;
  whatWouldHappen: string;
  learnings: string[];
  branchOptionId?: string;
}

export class DecisionReplay {
  replay(result: DecisionResult, actualOutcome?: unknown): ReplayResult {
    const winner = result.selected;
    const happened =
      actualOutcome !== undefined
        ? `Outcome recorded: ${JSON.stringify(actualOutcome).slice(0, 200)}`
        : "No outcome recorded yet";

    return {
      whatHappened: happened,
      whatShouldHappen: `Execute ${winner.optionType} path: ${winner.description}`,
      whatWouldHappen: `Alternative paths existed: ${result.options.length} options; highest EV was ${winner.id}`,
      learnings: [
        `Selected ${winner.optionType} with confidence ${result.confidence.toFixed(2)}`,
        result.explanation,
      ],
    };
  }

  compare(result: DecisionResult, branchOptionId: string): ReplayResult {
    const branch = result.options.find((o) => o.id === branchOptionId);
    const base = this.replay(result);
    if (!branch) return base;

    return {
      ...base,
      branchOptionId,
      whatWouldHappen: `If ${branch.optionType} (${branch.id}) were chosen: EV≈${branch.expectedValue?.toFixed(1) ?? "n/a"}, risk=${branch.risk}`,
      learnings: [
        ...base.learnings,
        `Counterfactual: ${branch.label ?? branch.option} vs winner ${result.selected.id}`,
      ],
    };
  }

  branch(result: DecisionResult, branchOptionId: string): ReplayResult {
    return this.compare(result, branchOptionId);
  }
}

export const decisionReplay = new DecisionReplay();
