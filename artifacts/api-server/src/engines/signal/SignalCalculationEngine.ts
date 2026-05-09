import { logger } from "../../lib/logger.js";
import type { SignalState } from "../../types/signal.js";
import {
  SIGNAL_WEIGHTS,
  SIGNAL_THRESHOLDS,
} from "../../constants/signals.js";
import { CONDITIONS, type Condition } from "../../constants/conditions.js";

// SignalCalculationEngine — placeholder for the real Prompt 7 implementation.
// Active execution loop relies on the SignalWorker (Prompt 6) which writes
// signal_snapshots rows directly. This stub exists so callers that still rely
// on the legacy class-based shape continue to compile.
//
// Spec: Prompt 7 (full implementation), DOC_05 §Signal Calculation Engine.
export class SignalCalculationEngine {
  async calculate(userId: string): Promise<SignalState> {
    logger.info({ userId }, "[SignalCalculationEngine] stub.calculate");
    return {
      userId,
      momentum:    50,
      consistency: 50,
      velocity:    50,
      condition:   CONDITIONS.STABILITY,
      streak:      0,
      computedAt:  new Date().toISOString(),
    };
  }

  computeCondition(momentum: number, consistency: number, velocity: number): Condition {
    const composite =
      momentum    * SIGNAL_WEIGHTS.MOMENTUM +
      consistency * SIGNAL_WEIGHTS.CONSISTENCY +
      velocity    * SIGNAL_WEIGHTS.VELOCITY;

    if (composite >= SIGNAL_THRESHOLDS.MOMENTUM.OPTIMAL)    return CONDITIONS.AFFLUENCE;
    if (composite >= SIGNAL_THRESHOLDS.MOMENTUM.BUILDING)   return CONDITIONS.STABILITY;
    if (composite >= SIGNAL_THRESHOLDS.MOMENTUM.RECOVERING) return CONDITIONS.URGENCY;
    if (composite >= SIGNAL_THRESHOLDS.MOMENTUM.CRITICAL)   return CONDITIONS.DANGER;
    return CONDITIONS.NOTHINGNESS;
  }
}
