import type { DriftResult, IdentityInput, ValuesResult } from "../contracts/types.js";

export class IdentityDrift {
  detect(input: IdentityInput, values: ValuesResult): DriftResult {
    const signals: string[] = [];
    let action: DriftResult["action"] = "adapt";

    if (input.feedback?.burnout || input.life?.burnoutRisk) {
      signals.push("burnout");
      action = "pause";
    }

    if (values.conflicts.length > 0) {
      signals.push("misalignment");
      action = "recover";
    }

    const topValue = values.rankedValues[0]?.key;
    if (input.execution?.contradictsValues && topValue) {
      signals.push("value_erosion");
      action = "escalate";
    }

    if (input.feedback?.falseGoal || input.beliefs?.stale) {
      signals.push("false_goals");
    }

    const detected = signals.length > 0;
    if (!detected) action = "adapt";

    return { detected, signals, action };
  }
}

export const identityDrift = new IdentityDrift();
