import { logger } from "../../lib/logger.js";
import type { SignalState } from "../../types/signal.js";
import type { Condition } from "../../constants/conditions.js";
import { CONDITIONS, CONDITION_RULES } from "../../constants/conditions.js";

/**
 * ConditionEvaluationEngine — Maps signal state to a Condition Code.
 * The condition code gates what the user is allowed to do.
 *
 * TODO (Prompt 7): Implement full condition logic with hysteresis and override rules
 */
export class ConditionEvaluationEngine {
  evaluate(signals: SignalState): Condition {
    logger.info({ userId: signals.userId }, "ConditionEvaluationEngine.evaluate");
    // TODO: Add hysteresis (don't flip condition on single data point)
    // TODO: Add override rules from ControlEngine
    return signals.condition as Condition;
  }

  getAllowedTaskTypes(condition: Condition): string[] {
    return CONDITION_RULES[condition]?.allowedTypes ?? [];
  }

  getMaxDailyTasks(condition: Condition): number {
    return CONDITION_RULES[condition]?.maxDailyTasks ?? 2;
  }
}
