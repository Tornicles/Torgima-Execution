import type { ExperimentInput, Hypothesis, HypothesisType } from "../contracts/types.js";

export class HypothesisLab {
  formulate(input: ExperimentInput): Hypothesis {
    const type = input.hypothesisType ?? "execution";
    const claim =
      input.belief?.statement
        ? `If we act on: ${String(input.belief.statement).slice(0, 120)}`
        : `Improving ${input.goal} via controlled variant will outperform control`;

    return {
      claim,
      reason: input.decision?.explanation
        ? String(input.decision.explanation).slice(0, 200)
        : "Decision layer proposed change requires empirical validation",
      expectedOutcome: `Measurable improvement on: ${(input.metrics ?? ["impact"]).join(", ")}`,
      risk: type === "identity" ? 0.8 : type === "economic" ? 0.5 : 0.35,
      validationPlan: `Run ${type} experiment with falsifiable success/disprove criteria`,
      type,
      falsifiable: true,
    };
  }

  disproveCriteria(hypothesis: Hypothesis, metrics: string[]): Record<string, unknown> {
    return {
      success: metrics.map((m) => ({ metric: m, minDelta: 0.05 })),
      disprove: metrics.map((m) => ({ metric: m, maxDelta: -0.02 })),
      hypothesis: hypothesis.claim,
    };
  }
}

export const hypothesisLab = new HypothesisLab();
