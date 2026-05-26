import type { ReliabilityInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "ERASE_FAILURES",
  "IGNORE_INCIDENTS",
  "SKIP_ROLLBACK",
  "OVERRIDE_GOVERNANCE",
  "DISABLE_OBSERVABILITY",
]);

export class ReliabilityPolicy {
  validate(input: ReliabilityInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }
    const ctx = { ...input.execution, ...input.governance } as Record<string, unknown>;
    if (ctx.eraseFailures || ctx.ignoreIncidents || ctx.skipRollback || ctx.disableObservability) {
      violations.push("Cannot erase failures, ignore incidents, skip rollback, or disable observability");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const reliabilityPolicy = new ReliabilityPolicy();
