import type { InfrastructureInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "DEPLOY_WITHOUT_RECOVERY",
  "IGNORE_LIMITS",
  "DISABLE_OBSERVABILITY",
  "CROSS_TENANT_ACCESS",
  "FORCE_SCALING",
]);

export class InfrastructurePolicy {
  validate(input: InfrastructureInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }
    const ctx = { ...input.execution } as Record<string, unknown>;
    if (ctx.deployWithoutRecovery || ctx.crossTenantAccess || ctx.forceScaling) {
      violations.push("Cannot deploy without recovery, cross tenant access, or force scaling");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const infrastructurePolicy = new InfrastructurePolicy();
