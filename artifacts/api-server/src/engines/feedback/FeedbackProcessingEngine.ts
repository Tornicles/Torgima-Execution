/**
 * Unified feedback processing package.
 *
 * - `processFeedbackSubmission` — Phase 1 deterministic intake (DOC 10); used by POST /api/v1/feedback/submit
 * - `processFeedback` — production path with Bhudhi enrichment; used by POST /api/orders/:id/feedback
 */

export {
  processFeedbackSubmission,
  processFeedbackClarification,
  runAntiGamingChecks,
  classifyVerdict,
  type FeedbackSubmissionPayload,
  type FeedbackProcessResult,
  type FeedbackVerdict,
} from "./submitFeedbackPhase1.js";

export {
  processFeedback,
  type FeedbackInput,
  type FeedbackResult,
} from "./processFeedbackLegacy.js";

import { processFeedbackSubmission, processFeedbackClarification } from "./submitFeedbackPhase1.js";
import { processFeedback } from "./processFeedbackLegacy.js";
import type { FeedbackSubmissionPayload, FeedbackProcessResult } from "./submitFeedbackPhase1.js";
import type { FeedbackInput, FeedbackResult } from "./processFeedbackLegacy.js";

export class FeedbackProcessingEngine {
  /** Phase 1 — structured proof payload, verdict enum, worker chain via FEEDBACK_* events. */
  processSubmission(
    userId: string,
    payload: FeedbackSubmissionPayload,
  ): Promise<FeedbackProcessResult> {
    return processFeedbackSubmission(userId, payload);
  }

  processClarification(
    userId: string,
    feedbackId: string,
    clarificationText: string,
  ): Promise<FeedbackProcessResult> {
    return processFeedbackClarification(userId, feedbackId, clarificationText);
  }

  /** Production orders API — reflection score, Bhudhi critic, memory, psychology hooks. */
  process(input: FeedbackInput): Promise<FeedbackResult> {
    return processFeedback(input);
  }
}
