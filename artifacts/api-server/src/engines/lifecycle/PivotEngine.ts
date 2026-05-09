import { logger } from "../../lib/logger.js";

/**
 * PivotEngine — Detects when a strategy pivot is warranted and
 * generates pivot review options for the user.
 *
 * TODO (Prompt 12): Implement pivot detection and review generation
 */
export class PivotEngine {
  async shouldPivot(blueprintId: string): Promise<boolean> {
    logger.info({ blueprintId }, "PivotEngine.shouldPivot — TODO");
    return false;
  }
}
