/**
 * @deprecated Import from `../feedback/FeedbackProcessingEngine.js` or `../feedback/submitFeedbackPhase1.js`.
 * Re-export shim — Phase 1 implementation lives under engines/feedback/.
 */
export {
  processFeedbackSubmission,
  processFeedbackClarification,
  runAntiGamingChecks,
  classifyVerdict,
  type FeedbackSubmissionPayload,
  type FeedbackProcessResult,
  type FeedbackVerdict,
} from "../feedback/submitFeedbackPhase1.js";

export { FeedbackProcessingEngine } from "../feedback/FeedbackProcessingEngine.js";

export { validateProof } from "./feedback/ProofValidator.js";
export { detectGaming } from "./feedback/GamingDetector.js";
export {
  buildInterrogationDecision,
  selectInterrogationQuestion,
  shouldTriggerInterrogation,
} from "./feedback/InterrogationEngine.js";
export { classifyBlocker, classifyBlockerWithBhudhiFallback } from "./feedback/BlockerClassifier.js";
export { determineFeedbackVerdict, confidenceLabel } from "./feedback/FeedbackVerdictEngine.js";
export { applyLateFeedbackPenalty } from "./feedback/lateFeedback.js";
