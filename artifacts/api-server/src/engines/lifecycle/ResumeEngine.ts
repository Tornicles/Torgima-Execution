import { logger } from "../../lib/logger.js";
import type { Blueprint } from "../../types/blueprint.js";

/**
 * ResumeEngine — Handles blueprint resume from paused state.
 *
 * TODO (Prompt 11): Implement resume with recovery task injection
 */
export class ResumeEngine {
  resume(blueprint: Blueprint): Blueprint {
    logger.info({ blueprintId: blueprint.id }, "ResumeEngine.resume");
    return { ...blueprint, status: "active", pausedReason: null };
  }
}
