/**
 * Prompt 7 — Intelligence + Behavior layer (canonical exports).
 */

export {
  validateOutcome,
  resolveFlag,
  getOpenFlags,
  type ValidationStatus,
} from "../outcome/OutcomeValidationEngine.js";

export {
  detectFalseProgress,
  CORRECTION_BY_PATTERN,
  FALSE_PROGRESS_PATTERNS,
  type FalseProgressPattern,
} from "./FalseProgressDetectionEngine.js";

export { evaluateIdentity } from "../identity/IdentityEngine.js";

export { evaluateReward, getPendingRewards, markRewardsDelivered } from "../reward/RewardEngine.js";

export { recordCompulsionLoopStage, type CompulsionLoopStage } from "./CompulsionLoopEngine.js";

export {
  scanPatterns,
  resolvePattern,
  getActivePatterns,
  PATTERN_SPEC_LABELS,
} from "../pattern/PatternLearningEngine.js";

export { assessBurnoutRisk, type BurnoutRiskLevel } from "./BurnoutDetectionEngine.js";

export {
  classifyFailure,
  FAILURE_CATEGORIES,
  type FailureCategory,
} from "../failure/FailureClassificationEngine.js";

export { traceDecision, calculateCognitiveLoad } from "../decision-trace/DecisionTraceSystem.js";

export {
  recordValidationMemory,
  getValidationHistory,
  goalFingerprint,
} from "../validation/ValidationMemoryService.js";

export {
  recordStrategicAssumptions,
  checkAssumptionDrift,
  markAssumptionReviewed,
  type AssumptionDriftWarning,
} from "../validation/AssumptionMonitoringService.js";
