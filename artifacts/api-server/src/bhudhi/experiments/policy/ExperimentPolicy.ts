import type { ExperimentInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "EXPERIMENT_ON_IDENTITY",
  "OVERRIDE_SIGNALS",
  "BREAK_CONDITIONS",
  "FORCE_USERS",
  "HIDE_RESULTS",
]);

export class ExperimentPolicy {
  validate(input: ExperimentInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }
    if (input.hypothesisType === "identity" && !input.constraints?.includes("ALLOW_IDENTITY_EXPERIMENT")) {
      violations.push("Cannot experiment on identity without explicit allowance");
    }
    const ctx = input.belief ?? {};
    if (ctx.overrideSignals || ctx.breakConditions || ctx.hideResults) {
      violations.push("Experiments cannot override signals, break conditions, or hide results");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const experimentPolicy = new ExperimentPolicy();
