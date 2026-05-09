import { logger } from "../../lib/logger.js";
import type { SignalState } from "../../types/signal.js";
import { CONDITION_RULES, type Condition } from "../../constants/conditions.js";

// ConditionEvaluationEngine — placeholder for the real Prompt 7 implementation.
// Active execution loop relies on the ConditionWorker (Prompt 6) which writes
// the conditions row directly. The full hysteresis/override logic lands in
// Prompt 7 as part of the signal -> condition -> control chain.
//
// Spec: Prompt 7 (full implementation), DOC_07 §Condition Evaluation Engine.
export class ConditionEvaluationEngine {
  evaluate(signals: SignalState): Condition {
    logger.info({ userId: signals.userId }, "[ConditionEvaluationEngine] stub.evaluate");
    return signals.condition;
  }

  getAllowedTaskTypes(condition: Condition): string[] {
    return CONDITION_RULES[condition]?.allowedTypes ?? [];
  }

  getMaxDailyTasks(condition: Condition): number {
    return CONDITION_RULES[condition]?.maxDailyTasks ?? 1;
  }
}
