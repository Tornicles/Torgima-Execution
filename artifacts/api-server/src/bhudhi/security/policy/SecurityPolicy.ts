import type { SecurityInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "REWRITE_SIGNALS",
  "OVERRIDE_CONDITIONS",
  "DISABLE_GOVERNANCE",
  "SELF_ESCALATE",
  "READ_SECRETS_DIRECTLY",
]);

export class SecurityPolicy {
  validate(input: SecurityInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }
    const ctx = { ...input.execution, ...input.governance } as Record<string, unknown>;
    if (ctx.selfEscalate || ctx.disableGovernance || ctx.readSecretsDirectly) {
      violations.push("Cannot self-escalate, disable governance, or read secrets directly");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const securityPolicy = new SecurityPolicy();
