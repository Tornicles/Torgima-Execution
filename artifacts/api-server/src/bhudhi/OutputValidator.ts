import type { BhudhiTrigger } from "../types/bhudhi.js";

/**
 * OutputValidator — Validates that Bhudhi outputs conform to their expected contracts.
 * TODO (Prompt 3): Implement per-trigger output schemas with Zod
 */
export class OutputValidator {
  validate(trigger: BhudhiTrigger, output: Record<string, unknown>): boolean {
    // TODO: Use Zod schemas per trigger type
    return typeof output === "object" && output !== null;
  }
}
