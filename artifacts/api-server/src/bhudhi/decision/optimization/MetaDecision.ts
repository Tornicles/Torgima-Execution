import type { DecisionOption } from "../contracts/types.js";

export interface MetaDecisionResult {
  quality: number;
  speed: "fast" | "normal" | "slow";
  drift: number;
  action: "optimize" | "slow" | "escalate" | "simulate";
}

export class MetaDecision {
  evaluate(
    options: DecisionOption[],
    selected: DecisionOption,
    processingMs: number,
  ): MetaDecisionResult {
    const spread =
      options.length > 0
        ? Math.max(...options.map((o) => o.expectedValue ?? 0)) -
          Math.min(...options.map((o) => o.expectedValue ?? 0))
        : 0;

    const quality = selected.confidence * (spread > 0 ? 0.85 : 0.6);
    const drift = spread / Math.max(selected.expectedValue ?? 1, 1);

    let speed: MetaDecisionResult["speed"] = "normal";
    if (processingMs < 50) speed = "fast";
    else if (processingMs > 500) speed = "slow";

    let action: MetaDecisionResult["action"] = "optimize";
    if (selected.risk > 0.75) action = "simulate";
    else if (selected.confidence < 0.5) action = "escalate";
    else if (speed === "fast" && quality < 0.6) action = "slow";

    return { quality, speed, drift, action };
  }
}

export const metaDecision = new MetaDecision();
