import { processFeedback } from "../feedback/FeedbackProcessingEngine.js";
import { dispatchPendingEvents } from "../../services/EventDispatcher.js";

export interface FeedbackSubmission {
  userId: string;
  blueprintId: string;
  orderId: string;
  completionStatus: "completed" | "partial" | "failed" | "skipped";
  feedbackText?: string;
  score?: number;
  proofJson?: Record<string, unknown>;
  blockerJson?: Record<string, unknown>;
  durationMinutes?: number;
  frictionScore?: number;
  confidenceScore?: number;
  idempotencyKey?: string;
}

export interface PrimaryLoopResult {
  feedbackId?: string;
  queued: boolean;
  nextOrderId?: string;
  nextStep?: "answer_question" | "loop_running";
  message?: string;
  generationMs?: number;
  requiresInterrogation?: boolean;
  interrogationQuestion?: string;
  verdictStatus?: "accepted" | "needs_interrogation" | "rejected";
}

/**
 * Primary loop entry: persist feedback, dispatch events — workers run the full chain.
 * No synchronous generateNextTask (bypasses signal → condition → enforcement).
 */
export async function runPrimaryLoop(
  userId: string,
  data: FeedbackSubmission,
): Promise<PrimaryLoopResult> {
  const start = Date.now();

  const result = await processFeedback({
    orderId: data.orderId,
    userId,
    blueprintId: data.blueprintId,
    completionStatus: data.completionStatus,
    score: data.score ?? 7,
    reflection: data.feedbackText?.trim() || "Execution feedback submitted for this order.",
    proofJson: data.proofJson,
    blockerJson: data.blockerJson,
    durationMinutes: data.durationMinutes,
    frictionScore: data.frictionScore,
    confidenceScore: data.confidenceScore,
    idempotencyKey: data.idempotencyKey ?? `primary-loop:${data.orderId}:${Date.now()}`,
  });

  if (result.requiresInterrogation) {
    return {
      feedbackId: result.feedbackId,
      queued: true,
      nextStep: "answer_question" as const,
      message: "Please answer the question to continue.",
      requiresInterrogation: true,
      interrogationQuestion: result.interrogationQuestion,
      verdictStatus: result.verdictStatus,
      generationMs: Date.now() - start,
    };
  }

  await dispatchPendingEvents().catch(() => null);

  return {
    feedbackId: result.feedbackId,
    queued: true,
    nextStep: "loop_running" as const,
    message: "Feedback received. Next task is being prepared.",
    verdictStatus: result.verdictStatus,
    generationMs: Date.now() - start,
  };
}
