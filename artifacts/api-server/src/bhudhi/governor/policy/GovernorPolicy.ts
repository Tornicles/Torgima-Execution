import type { GovernorInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "REWRITE_SIGNALS",
  "REWRITE_CONDITIONS",
  "APPROVE_SELF",
  "REMOVE_GOVERNANCE",
  "ERASE_MEMORY",
  "OVERRIDE_BLUEPRINT",
]);

export class GovernorPolicy {
  validate(input: GovernorInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }
    const ctx = { ...input.execution, ...input.decisions } as Record<string, unknown>;
    if (ctx.approveSelf || ctx.removeGovernance || ctx.eraseMemory || ctx.overrideBlueprint) {
      violations.push("Governor cannot approve self, remove governance, erase memory, or override blueprint");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const governorPolicy = new GovernorPolicy();
