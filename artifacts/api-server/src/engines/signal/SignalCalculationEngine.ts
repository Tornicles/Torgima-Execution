import { logger } from "../../lib/logger.js";
import type { SignalState } from "../../types/signal.js";
import { SIGNAL_WEIGHTS, SIGNAL_THRESHOLDS, STREAK_BONUS_MULTIPLIER, STREAK_BONUS_THRESHOLD } from "../../constants/signals.js";
import { CONDITIONS } from "../../constants/conditions.js";

/**
 * SignalCalculationEngine — Computes the three core signals:
 * - momentum: recent completion rate weighted by task difficulty
 * - consistency: habit and daily execution pattern
 * - velocity: rate of progress toward phase milestones
 *
 * TODO (Prompt 6): Implement full signal calculation from feedback history
 */
export class SignalCalculationEngine {
  async calculate(userId: string): Promise<SignalState> {
    logger.info({ userId }, "SignalCalculationEngine.calculate — TODO");
    // TODO: Query FeedbackRepository, compute weighted signals
    return {
      userId,
      momentum: 70,
      consistency: 65,
      velocity: 60,
      condition: CONDITIONS.BUILDING,
      streak: 3,
      computedAt: new Date().toISOString(),
    };
  }

  private computeCondition(momentum: number, consistency: number, velocity: number): string {
    const composite =
      momentum * SIGNAL_WEIGHTS.MOMENTUM +
      consistency * SIGNAL_WEIGHTS.CONSISTENCY +
      velocity * SIGNAL_WEIGHTS.VELOCITY;

    if (composite >= SIGNAL_THRESHOLDS.MOMENTUM.OPTIMAL) return CONDITIONS.OPTIMAL;
    if (composite >= SIGNAL_THRESHOLDS.MOMENTUM.BUILDING) return CONDITIONS.BUILDING;
    if (composite >= SIGNAL_THRESHOLDS.MOMENTUM.RECOVERING) return CONDITIONS.RECOVERING;
    if (composite >= SIGNAL_THRESHOLDS.MOMENTUM.CRITICAL) return CONDITIONS.CRITICAL;
    return CONDITIONS.BLOCKED;
  }
}
