import { processFeedback } from "../feedback/FeedbackProcessingEngine.js";
import { generateNextTask } from "./generateNextTask.js";

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
  generationMs?: number;
  requiresInterrogation?: boolean;
  interrogationQuestion?: string;
  verdictStatus?: "accepted" | "needs_interrogation" | "rejected";
}

/**
 * Primary loop entry (Prompt 5): persist feedback via FeedbackProcessingEngine,
 * let event workers run signal → condition → control, attempt immediate next task.
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
      requiresInterrogation: true,
      interrogationQuestion: result.interrogationQuestion,
      verdictStatus: result.verdictStatus,
      generationMs: Date.now() - start,
    };
  }

  const next = await generateNextTask(userId, {
    blueprintId: data.blueprintId,
    reason: "FEEDBACK_COMPLETE",
    generationMode: "post_feedback",
  });

  return {
    feedbackId: result.feedbackId,
    queued: true,
    nextOrderId: next.order?.id,
    verdictStatus: result.verdictStatus,
    generationMs: Date.now() - start,
  };
}
