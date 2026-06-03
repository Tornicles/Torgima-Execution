/**
 * @deprecated Import from `../feedback/FeedbackProcessingEngine.js` or `../feedback/submitFeedbackPhase1.js`.
 * Re-export shim — Phase 1 implementation lives under engines/feedback/.
 */
export {
  processFeedbackSubmission,
  runAntiGamingChecks,
  classifyVerdict,
  type FeedbackSubmissionPayload,
  type FeedbackProcessResult,
  type FeedbackVerdict,
} from "../feedback/submitFeedbackPhase1.js";

export { FeedbackProcessingEngine } from "../feedback/FeedbackProcessingEngine.js";
