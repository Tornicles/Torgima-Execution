import type { WorldInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "REWRITE_SIGNALS",
  "REWRITE_CONDITIONS",
  "INVENT_STATE",
  "FORCE_EXECUTION",
  "REWRITE_HISTORY",
]);

export class WorldPolicy {
  validate(input: WorldInput): { allowed: boolean; violations: string[]; escalate: boolean } {
    const violations: string[] = [];

    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }

    const ctx = { ...input.signals, ...input.conditions } as Record<string, unknown>;
    if (ctx.rewriteSignals || ctx.rewriteConditions || ctx.inventState || ctx.forceExecution) {
      violations.push("World model cannot rewrite signals, conditions, invent state, or force execution");
    }
    if (ctx.rewriteHistory) {
      violations.push("World model cannot rewrite history");
    }

    return {
      allowed: violations.length === 0,
      violations,
      escalate: violations.length > 0 || input.signals?.global === "danger",
    };
  }
}

export const worldPolicy = new WorldPolicy();
