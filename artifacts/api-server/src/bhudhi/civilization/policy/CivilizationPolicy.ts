import type { CivilizationInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "CONTROL_HUMANS",
  "REPLACE_INSTITUTIONS",
  "REWRITE_SIGNALS",
  "AUTO_EXECUTE_SIMULATION",
  "REMOVE_UNCERTAINTY",
]);

export class CivilizationPolicy {
  validate(input: CivilizationInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      const key = c.toUpperCase().replace(/\s/g, "_");
      if (FORBIDDEN.has(key)) violations.push(`Forbidden: ${c}`);
    }
    const sim = input.simulation as Record<string, unknown> | undefined;
    if (sim?.autoExecute || sim?.removeUncertainty) {
      violations.push("Civilization cannot auto-execute simulations or remove uncertainty");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const civilizationPolicy = new CivilizationPolicy();
