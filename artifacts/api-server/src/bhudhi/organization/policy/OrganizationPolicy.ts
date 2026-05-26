import type { OrgInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "INVENT_AUTHORITY",
  "OVERRIDE_GOVERNANCE",
  "REWRITE_SIGNALS",
  "FORCE_EXECUTION",
  "REMOVE_OWNERSHIP",
]);

export class OrganizationPolicy {
  validate(input: OrgInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }
    const ctx = { ...input.signals, ...input.execution } as Record<string, unknown>;
    if (ctx.inventAuthority || ctx.overrideGovernance || ctx.rewriteSignals) {
      violations.push("Organization OS cannot invent authority, override governance, or rewrite signals");
    }
    if (ctx.forceExecution || ctx.removeOwnership) {
      violations.push("Organization OS cannot force execution or remove ownership");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const organizationPolicy = new OrganizationPolicy();
