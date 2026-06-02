/** Phase 1 prerequisite path — canonical signal engine entry. */
export {
  calculate,
  assignCondition,
  explainSignal,
  isPowerChange,
  sanitizeNumericSignalMetrics,
  calcCompletionRate,
  calcWeightedScore,
  mergeStructuredFeedbackMetrics,
  CONDITION_LEVELS,
} from "../signal/SignalCalculationEngine.js";
export type { SignalMetrics } from "../signal/SignalCalculationEngine.types.js";
