import type { orders } from "@workspace/db";
import type {
  FeedbackSubmissionPayload,
  FeedbackVerdict,
} from "../../feedback/submitFeedbackPhase1.js";
import type { GamingDetectionResult } from "./GamingDetector.js";
import type { ProofValidationResult } from "./ProofValidator.js";
import type { InterrogationDecision } from "./InterrogationEngine.js";
import type { BlockerClassification } from "./BlockerClassifier.js";

export type VerdictContext = {
  payload: FeedbackSubmissionPayload;
  order: typeof orders.$inferSelect;
  proofPresent: boolean;
  proofValidation: ProofValidationResult;
  gaming: GamingDetectionResult;
  confidence_multiplier: number;
  interrogation: InterrogationDecision;
  blocker?: BlockerClassification;
  hasPriorClarification?: boolean;
  integrityHold?: boolean;
};

export function determineFeedbackVerdict(ctx: VerdictContext): FeedbackVerdict {
  const { payload, gaming, proofValidation, interrogation, blocker, hasPriorClarification } = ctx;

  if (gaming.legacy_reason === "score_inflation") {
    return "REJECTED";
  }

  if (gaming.trigger_hold_for_review || gaming.flags.includes("REPEATED_PERFECT_SCORE_PATTERN")) {
    return "HELD_FOR_REVIEW";
  }

  if (gaming.legacy_reason === "instant_completion" || gaming.flags.includes("INSTANT_COMPLETION")) {
    return "HELD_FOR_REVIEW";
  }

  if (ctx.integrityHold) {
    return "HELD_FOR_REVIEW";
  }

  if (payload.completion === "BLOCKED") {
    if ((payload.blockerReason ?? "").trim().length >= 5 && blocker) {
      return "BLOCKED_CONFIRMED";
    }
    return "CLARIFICATION_REQUIRED";
  }

  if (payload.completion === "FAILED") {
    const reflection = (payload.userNotes ?? payload.blockerReason ?? "").trim();
    if (reflection.length >= 20) return "FAILED_CONFIRMED";
    return "CLARIFICATION_REQUIRED";
  }

  if (payload.completion === "SKIPPED") {
    return gaming.legacy_reason === "skipped_hard_proof_task" ? "HELD_FOR_REVIEW" : "REJECTED";
  }

  if (payload.completion === "PARTIAL") {
    if (ctx.proofPresent && !proofValidation.valid) return "CLARIFICATION_REQUIRED";
    if (ctx.confidence_multiplier >= 0.5 && ctx.confidence_multiplier < 0.7) {
      return "PARTIAL_ACCEPTED";
    }
    return "PARTIAL_ACCEPTED";
  }

  if (payload.completion === "COMPLETED") {
    if (ctx.order.proof_required && !ctx.proofPresent) {
      return "CLARIFICATION_REQUIRED";
    }
    if (ctx.order.proof_required && !proofValidation.valid) {
      return hasPriorClarification ? "REJECTED" : "CLARIFICATION_REQUIRED";
    }
    if (interrogation.required && !hasPriorClarification) {
      return "CLARIFICATION_REQUIRED";
    }
    if (ctx.confidence_multiplier >= 0.5 && ctx.confidence_multiplier < 0.7) {
      return "PARTIAL_ACCEPTED";
    }
    if (gaming.gaming_suspected && ctx.confidence_multiplier < 0.7) {
      return hasPriorClarification ? "ACCEPTED" : "CLARIFICATION_REQUIRED";
    }
    return "ACCEPTED";
  }

  return "CLARIFICATION_REQUIRED";
}

export function confidenceLabel(multiplier: number): "high" | "medium" | "low" {
  if (multiplier >= 0.9) return "high";
  if (multiplier >= 0.7) return "medium";
  return "low";
}
