import type { feedback, orders } from "@workspace/db";
import type { FeedbackSubmissionPayload } from "../../feedback/submitFeedbackPhase1.js";

export type GamingDetectionResult = {
  gaming_suspected: boolean;
  flags: string[];
  confidence_multiplier: number;
  trigger_interrogation: boolean;
  trigger_hold_for_review: boolean;
  legacy_reason?: string;
};

function scoreFromPayload(payload: FeedbackSubmissionPayload): number {
  if (payload.effortScore != null) return Math.min(10, Math.max(0, payload.effortScore * 2));
  return 5;
}

export function detectGaming(params: {
  payload: FeedbackSubmissionPayload;
  order: typeof orders.$inferSelect;
  recentFeedbacks: (typeof feedback.$inferSelect)[];
  reflection: string;
  proofUnrelated?: boolean;
  orderStartedAt?: Date | null;
}): GamingDetectionResult {
  const { payload, order, recentFeedbacks, reflection, proofUnrelated, orderStartedAt } = params;
  const flags: string[] = [];
  let confidence_multiplier = 1;
  let trigger_interrogation = false;
  let trigger_hold_for_review = false;
  let legacy_reason: string | undefined;

  const score = scoreFromPayload(payload);
  const notes = reflection.trim();
  const duration = payload.durationMinutes ?? 0;
  const estimate = order.time_estimate_minutes ?? 30;

  if (
    payload.effortScore === 5 &&
    payload.frictionScore === 1 &&
    notes.length < 10 &&
    duration < estimate * 0.2
  ) {
    return {
      gaming_suspected: true,
      flags: ["SCORE_INFLATION"],
      confidence_multiplier: 0.2,
      trigger_interrogation: false,
      trigger_hold_for_review: false,
      legacy_reason: "score_inflation",
    };
  }

  if (score >= 9 && notes.length < 50) {
    flags.push("HIGH_SCORE_WEAK_REFLECTION");
    confidence_multiplier -= 0.3;
    trigger_interrogation = true;
  }

  if (payload.completion === "FAILED" && score >= 7) {
    flags.push("FAILED_BUT_HIGH_SCORE");
    confidence_multiplier -= 0.25;
    trigger_interrogation = true;
  }

  const lastSeven = recentFeedbacks.slice(0, 7);
  if (lastSeven.length >= 5) {
    const perfect = lastSeven.filter((f) => (f.score ?? 0) === 10);
    if (perfect.length >= 5) {
      const avgReflection =
        perfect.reduce((sum, f) => sum + (f.reflection?.trim().length ?? 0), 0) / perfect.length;
      if (avgReflection < 80) {
        flags.push("REPEATED_PERFECT_SCORE_PATTERN");
        confidence_multiplier -= 0.2;
        trigger_hold_for_review = true;
      }
    }
  }

  const startedAt = orderStartedAt ?? order.started_at;
  if (startedAt) {
    const minutesSinceStart = (Date.now() - startedAt.getTime()) / 60_000;
    if (minutesSinceStart < 5 && estimate > 30) {
      flags.push("COMPLETION_TOO_FAST");
      confidence_multiplier -= 0.15;
      trigger_interrogation = true;
    }
  }

  if (duration < 2 && estimate > 15) {
    flags.push("INSTANT_COMPLETION");
    trigger_hold_for_review = true;
    legacy_reason = legacy_reason ?? "instant_completion";
  }

  if (order.proof_required && proofUnrelated) {
    flags.push("PROOF_UNRELATED_TO_TASK");
    confidence_multiplier -= 0.3;
    trigger_interrogation = true;
  }

  if (
    payload.completion === "SKIPPED" &&
    order.proof_required &&
    (order.difficulty === "hard" || order.difficulty === "very_hard")
  ) {
    flags.push("SKIPPED_HARD_PROOF_TASK");
    trigger_hold_for_review = true;
    legacy_reason = legacy_reason ?? "skipped_hard_proof_task";
  }

  confidence_multiplier = Math.max(0.2, confidence_multiplier);

  return {
    gaming_suspected: flags.length > 0,
    flags,
    confidence_multiplier,
    trigger_interrogation,
    trigger_hold_for_review,
    legacy_reason,
  };
}
