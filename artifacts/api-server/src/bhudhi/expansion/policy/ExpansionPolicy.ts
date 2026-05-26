import type { ExpansionInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "SELF_MODIFICATION",
  "REWRITE_SIGNALS",
  "REWRITE_CONDITIONS",
  "DISABLE_GOVERNANCE",
  "HIDE_EXPANSION",
]);

export class ExpansionPolicy {
  validate(input: ExpansionInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      const key = c.toUpperCase().replace(/\s/g, "_");
      if (FORBIDDEN.has(key)) violations.push(`Forbidden: ${c}`);
    }
    const mem = input.memory as Record<string, unknown> | undefined;
    if (mem?.selfModify || mem?.hideExpansion) {
      violations.push("Expansion cannot self-modify or hide expansion");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const expansionPolicy = new ExpansionPolicy();
