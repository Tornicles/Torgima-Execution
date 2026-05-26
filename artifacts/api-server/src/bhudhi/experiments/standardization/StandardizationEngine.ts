import type { CausalResult, PromotionAction, PromotionResult } from "../contracts/types.js";

export class StandardizationEngine {
  evaluate(params: {
    confidence: number;
    repeatability: number;
    stability: number;
    governanceOk: boolean;
  }): PromotionResult {
    const { confidence, repeatability, stability, governanceOk } = params;

    if (!governanceOk) {
      return { action: "reject", allowed: false, reason: "Governance approval required before promotion" };
    }

    if (confidence < 0.7 || repeatability < 0.6) {
      return {
        action: "repeat",
        allowed: false,
        reason: "One success ≠ truth — repeat experiment",
      };
    }

    if (stability < 0.5) {
      return { action: "archive", allowed: false, reason: "Results unstable — archive for reference" };
    }

    if (confidence >= 0.85 && repeatability >= 0.75 && stability >= 0.6) {
      return {
        action: "promote",
        allowed: true,
        reason: "Reality repeated the result — safe to standardize",
      };
    }

    return { action: "reject", allowed: false, reason: "Criteria not met for promotion" };
  }
}

export const standardizationEngine = new StandardizationEngine();
