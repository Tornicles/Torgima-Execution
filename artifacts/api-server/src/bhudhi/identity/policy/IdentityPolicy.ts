import type { IdentityInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "MANIPULATE_USER",
  "REPLACE_VALUES",
  "FORCE_IDENTITY",
  "EXPLOIT_EMOTION",
  "OPTIMIZE_ADDICTION",
  "OVERRIDE_SIGNALS",
  "OVERRIDE_CONDITIONS",
  "BYPASS_GOVERNANCE",
]);

export class IdentityPolicy {
  validate(input: IdentityInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];

    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }

    const ctx = { ...input.life, ...input.feedback } as Record<string, unknown>;
    if (ctx.manipulateUser || ctx.forceIdentity || ctx.exploitEmotion) {
      violations.push("Identity engine cannot manipulate, force identity, or exploit emotion");
    }
    if (ctx.overrideSignals || ctx.rewriteConditions || ctx.bypassGovernance) {
      violations.push("Identity cannot override signals, conditions, or governance");
    }

    return { allowed: violations.length === 0, violations };
  }
}

export const identityPolicy = new IdentityPolicy();
