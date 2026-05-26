import type { BeliefInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "INVENT_TRUTH",
  "MODIFY_SIGNALS",
  "REWRITE_CONDITIONS",
  "OVERWRITE_BLUEPRINT",
  "SELF_CONFIRM",
]);

export class BeliefPolicy {
  validate(input: BeliefInput & { constraints?: string[] }): {
    allowed: boolean;
    violations: string[];
    escalateUncertainty: boolean;
  } {
    const violations: string[] = [];

    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }

    const ctx = (input.research ?? input.signals ?? {}) as Record<string, unknown>;
    if (ctx.inventTruth || ctx.modifySignals || ctx.rewriteConditions || ctx.overwriteBlueprint) {
      violations.push("Belief engine cannot invent truths, modify signals, or rewrite blueprint");
    }
    if (ctx.selfConfirm) {
      violations.push("Belief engine cannot self-confirm without evidence");
    }

    const escalateUncertainty =
      violations.length > 0 ||
      input.signals?.global === "danger" ||
      Boolean((input.feedback as Record<string, unknown>)?.contradiction);

    return { allowed: violations.length === 0, violations, escalateUncertainty };
  }
}

export const beliefPolicy = new BeliefPolicy();
