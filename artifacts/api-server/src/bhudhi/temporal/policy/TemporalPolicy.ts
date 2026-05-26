import type { TemporalInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "IGNORE_SIGNALS",
  "COMPRESS_LIFE",
  "INVENT_TIME",
  "FORCE_DEADLINES",
  "ERASE_HISTORY",
]);

export class TemporalPolicy {
  validate(input: TemporalInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }
    const ctx = { ...input.life, ...input.execution } as Record<string, unknown>;
    if (ctx.ignoreSignals || ctx.inventTime || ctx.forceDeadlines || ctx.eraseHistory) {
      violations.push("Temporal engine cannot ignore signals, invent time, force deadlines, or erase history");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const temporalPolicy = new TemporalPolicy();
