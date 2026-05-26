import type { ErectorInput } from "../contracts/types.js";

const FORBIDDEN = new Set([
  "REWRITE_SIGNALS",
  "REWRITE_CONDITIONS",
  "AUTO_EXECUTE",
  "HIDE_FAILURES",
  "MODIFY_HISTORY",
]);

export class SimulationPolicy {
  validate(input: ErectorInput): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const c of input.constraints ?? []) {
      if (FORBIDDEN.has(c.toUpperCase().replace(/\s/g, "_"))) {
        violations.push(`Forbidden: ${c}`);
      }
    }
    const v = input.validation as Record<string, unknown> | undefined;
    if (v?.autoExecute || v?.hideFailures || v?.modifyHistory) {
      violations.push("Simulation cannot auto-execute, hide failures, or modify history");
    }
    return { allowed: violations.length === 0, violations };
  }
}

export const simulationPolicy = new SimulationPolicy();
