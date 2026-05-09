import { logger } from "../../lib/logger.js";
import type { Blueprint } from "../../types/blueprint.js";

/**
 * PauseEngine — Handles blueprint pause logic with reason tracking.
 *
 * TODO (Prompt 11): Implement pause with signal snapshot
 */
export class PauseEngine {
  pause(blueprint: Blueprint, reason: string): Blueprint {
    logger.info({ blueprintId: blueprint.id, reason }, "PauseEngine.pause");
    return { ...blueprint, status: "paused", pausedReason: reason };
  }
}
