import { logger } from "../../lib/logger.js";

/**
 * FrameworkActivationEngine — Activates and manages execution frameworks.
 * Frameworks layer rules on top of domain logic (e.g. Deep Work, GTD, Sprints).
 *
 * TODO (Prompt 13): Implement framework registry and activation rules
 */
export class FrameworkActivationEngine {
  async getActiveFrameworks(userId: string): Promise<string[]> {
    logger.info({ userId }, "FrameworkActivationEngine.getActiveFrameworks — TODO");
    return [];
  }
}
