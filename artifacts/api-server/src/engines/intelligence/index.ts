/**
 * Prompt 7 — Intelligence + Behavior layer (canonical exports).
 */

export {
  OutcomeValidationEngine,
  outcomeValidationEngine,
  validateOutcome,
  resolveFlag,
  resolveActiveFlagsForBlueprint,
  getOpenFlags,
  assertNoActiveFalseProgress,
  assertPhaseAdvancementAllowed,
  hasPassedOutcomeValidation,
  recordRealOutcome,
  type ValidationStatus,
  type Il2ValidationResult,
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
  PATTERN_MIN_OCCURRENCES,
  DOC21_PATTERN_TYPES,
  countBurnoutSignals,
  meetsPatternThreshold,
} from "../pattern/PatternLearningEngine.js";

export { assessBurnoutRisk, type BurnoutRiskLevel } from "./BurnoutDetectionEngine.js";

export {
  classifyFailure,
  FailureClassificationEngine,
  failureClassificationEngine,
  correctionTypeToTaskType,
  persistFailureClassificationOnFeedback,
  FAILURE_CATEGORIES,
  type FailureCategory,
} from "../failure/FailureClassificationEngine.js";

export {
  traceDecision,
  traceControlOutput,
  traceFailureRouting,
  tracePrioritySelection,
  calculateCognitiveLoad,
  getBlueprintStateVersion,
  IL4_DECISION_TYPES,
} from "../decision-trace/DecisionTraceSystem.js";

export {
  PriorityEngine,
  priorityEngine,
  scorePriorityCandidate,
  type PriorityCandidate,
  type PriorityContext,
} from "../priority/PriorityEngine.js";

export {
  detectFriction,
  detectFrictionForFeedback,
  FrictionDetectionEngine,
  frictionDetectionEngine,
  FRICTION_TYPES,
} from "../friction/FrictionDetectionEngine.js";

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

export {
  DependencyEngine,
  dependencyEngine,
  resolvePublishableOrder,
  markOrderDependenciesSatisfied,
  checkExecutability,
  createDependency,
  type DependencyCheckResult,
  type ResolutionTaskSpec,
} from "../execution-loop/DependencyEngine.js";
