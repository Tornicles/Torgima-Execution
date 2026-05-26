import type { TeamInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "FORCE_CONSENSUS",
  "OVERRIDE_GOVERNANCE",
  "ERASE_OWNERSHIP",
  "REPLACE_PEOPLE",
  "HIDE_CONFLICT",
]);

export class TeamPolicy {
  validate(input: TeamInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }
    const ctx = { ...input.execution } as Record<string, unknown>;
    if (ctx.forceConsensus || ctx.eraseOwnership || ctx.hideConflict) {
      violations.push("Cannot force consensus, erase ownership, or hide conflict");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const teamPolicy = new TeamPolicy();
