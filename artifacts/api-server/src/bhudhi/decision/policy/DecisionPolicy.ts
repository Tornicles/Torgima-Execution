import type { DecisionInput } from "../contracts/types.js";

const FORBIDDEN_ACTIONS = new Set([
  "MODIFY_SIGNALS",
  "MODIFY_CONDITIONS",
  "REWRITE_BLUEPRINT",
  "BYPASS_GOVERNANCE",
  "SELF_APPROVE",
  "OVERRIDE_VALIDATION",
]);

export class DecisionPolicy {
  validate(input: DecisionInput): { allowed: boolean; violations: string[]; escalateGovernance: boolean } {
    const violations: string[] = [];

    for (const c of input.constraints ?? []) {
      if (FORBIDDEN_ACTIONS.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden constraint: ${c}`);
      }
    }

    if (input.context?.overrideSignals || input.context?.modifyConditions) {
      violations.push("Decision engine cannot override signals or conditions");
    }

    if (input.context?.rewriteBlueprint) {
      violations.push("Decision engine cannot rewrite blueprint");
    }

    if (input.context?.bypassGovernance || input.context?.selfApprove) {
      violations.push("Decision engine cannot bypass governance or self-approve");
    }

    const escalateGovernance =
      violations.length > 0 ||
      (input.signals?.global === "danger") ||
      (input.constraints?.some((c) => c.toLowerCase().includes("critical")) ?? false);

    return {
      allowed: violations.length === 0,
      violations,
      escalateGovernance,
    };
  }
}

export const decisionPolicy = new DecisionPolicy();
