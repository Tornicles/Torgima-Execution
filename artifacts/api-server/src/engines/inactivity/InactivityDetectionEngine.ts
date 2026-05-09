import { logger } from "../../lib/logger.js";

/**
 * InactivityDetectionEngine — Detects when a user has gone inactive
 * and triggers re-engagement flows.
 *
 * TODO (Prompt 14): Implement inactivity detection with escalation
 */
export class InactivityDetectionEngine {
  async isInactive(userId: string, thresholdHours: number = 48): Promise<boolean> {
    logger.info({ userId, thresholdHours }, "InactivityDetectionEngine.isInactive — TODO");
    return false;
  }
}
