import type { CauseNode, WorldInput } from "../contracts/types.js";

export class CausalityEngine {
  buildCauseTree(input: WorldInput): CauseNode {
    const children: CauseNode[] = [];

    if (input.signals) {
      children.push({
        cause: `Signal state: ${String(input.signals.global ?? "neutral")}`,
        confidence: typeof input.signals.confidence === "number" ? input.signals.confidence : 0.6,
        impact: 0.4,
      });
    }

    if (input.feedback) {
      children.push({
        cause: "User feedback received",
        confidence: 0.75,
        impact: 0.5,
      });
    }

    if (input.execution) {
      children.push({
        cause: "Execution activity",
        confidence: 0.8,
        impact: 0.6,
      });
    }

    if (input.simulation) {
      children.push({
        cause: "Simulation branch active",
        confidence: 0.55,
        impact: 0.35,
      });
    }

    const root: CauseNode = {
      cause: input.trigger ? `Trigger: ${input.trigger}` : "World state update",
      confidence: 0.7,
      impact: 1,
      children,
    };

    return root;
  }

  /** Correlation ≠ cause — require minimum confidence for causal claims. */
  explain(eventCause: string, correlated: string[], minConfidence = 0.6): CauseNode | null {
    if (correlated.length === 0) return null;
    const confidence = Math.min(0.85, 0.4 + correlated.length * 0.1);
    if (confidence < minConfidence) return null;
    return {
      cause: eventCause,
      confidence,
      impact: 0.5,
      children: correlated.map((c) => ({ cause: c, confidence: confidence * 0.8, impact: 0.3 })),
    };
  }
}

export const causalityEngine = new CausalityEngine();
