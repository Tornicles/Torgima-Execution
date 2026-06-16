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
  applyBurnoutProtectiveActions,
  PATTERN_SPEC_LABELS,
  PATTERN_MIN_OCCURRENCES,
  DOC21_PATTERN_TYPES,
  countBurnoutSignals,
  meetsPatternThreshold,
} from "../pattern/PatternLearningEngine.js";

export {
  scoreBurnoutRisk,
  riskLevelFromScore,
  BURNOUT_INDICATORS,
  type BurnoutRiskAssessment,
} from "../pattern/BurnoutRiskScorer.js";

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

export { scoreAll } from "../failure/RootCauseScorer.js";
export { checkRepeatFailure } from "../failure/RepeatFailureDetector.js";
export { routeCorrection, CORRECTION_ROUTES } from "../failure/CorrectionRouter.js";
export { loadFailureEvidence } from "../failure/FailureEvidence.js";

export {
  DecisionTraceService,
  writeEngineDecision,
  DOC23_DECISION_TYPES,
  type DecisionTraceWriteInput,
} from "../decision/DecisionTraceService.js";
export {
  scoreCognitiveLoad,
  evaluateAndPersistCognitiveLoad,
} from "../decision/CognitiveLoadScorer.js";
export { applySimplification } from "../decision/SimplificationEngine.js";

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
  selectHighestValueTask,
  scoreTaskValue,
  scoreDimensions,
  dependencyUnlockOverrideApplies,
  TASK_VALUE_WEIGHTS,
  type PriorityCandidate,
  type PriorityContext,
  type PriorityResult,
} from "../priority/PriorityEngine.js";

export {
  detectFriction,
  detectFrictionForFeedback,
  runFrictionDetection,
  FrictionDetectionEngine,
  frictionDetectionEngine,
  FrictionClassifier,
  routeAdaptation,
  ADAPTATION_MATRIX,
  loadFrictionEvidence,
  buildFrictionEvidenceFromParts,
  DOC25_FRICTION_TYPES,
  FRICTION_TYPES,
} from "../friction/FrictionDetectionEngine.js";

export {
  processFileUpload,
  processExternalLink,
  validateUploadFile,
} from "../external/ExternalSignalProcessor.js";
export {
  scoreExternalTrust,
  canTriggerOutcomeReward,
} from "../external/ExternalTrustScorer.js";
export {
  processWebhook,
  verifyWebhookSignature,
  parseWebhookPayload,
  isApprovedWebhookSource,
} from "../external/WebhookRouter.js";
export {
  EXTERNAL_SIGNAL_TYPES,
  TRUSTED_DOMAINS,
  APPROVED_WEBHOOK_SOURCES,
} from "../external/externalTypes.js";

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
  type DependencyCheckResult,
  type ResolutionTaskSpec,
} from "../execution-loop/DependencyEngine.js";

export {
  checkExecutability,
  createDependency,
  ensureResolvablePublication,
  collectDependencyBlockedOrderIds,
  evaluateExecutabilityFromBlocks,
  calculateUnlockValue,
  generateResolutionTask,
  resolveBlockedExecution,
  resolutionEventForDependency,
  RESOLUTION_TASK_TYPE_MAP,
  DEPENDENCY_TYPES,
  type ExecutabilityResult,
} from "../dependency/DependencyEngine.js";

export {
  LockManager,
  WORKFLOWS,
  getWorkflow,
  CONFLICT_RULES,
  resolveConflictRules,
  resolveTaskGenerationConflict,
  OrchestrationHealthMonitor,
  OrchestrationCoordinator,
  feedbackCompletionEventChain,
  acquireWorkflowLocks,
  releaseWorkflowLocks,
} from "../orchestration/OrchestrationService.js";
export { Workflows } from "../orchestration/WorkflowDefinitions.js";
export { resolveConflict } from "../orchestration/SystemOrchestrationEngine.js";

export {
  OutcomeEvidenceScorer,
  determineValidationStatus,
  scoreOutcomeDimensions,
  applyLedgerEvidenceAdjustments,
  applySignalMovementBonus,
} from "../outcome/OutcomeEvidenceScorer.js";
export { FalseProgressDetector } from "../outcome/FalseProgressDetector.js";
export { CorrectionPathGenerator, CORRECTION_TASK_MAP } from "../outcome/CorrectionPathGenerator.js";
export { OutcomeBlockingEnforcer } from "../outcome/OutcomeBlockingEnforcer.js";
