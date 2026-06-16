/**
 * DOC21 Task 3 — weighted burnout risk scoring (0–100, non-clinical).
 */

import type { NormalizedBehaviorEvidence, RawFeedbackRow } from "./BehaviorEvidenceNormalizer.js";

export type BurnoutRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type BurnoutIndicatorKey =
  | "rising_friction"
  | "falling_confidence"
  | "longer_duration"
  | "completion_decline"
  | "more_failures"
  | "more_blockers"
  | "inactivity_after_hard"
  | "recovery_failing";

export const BURNOUT_INDICATORS: Record<
  BurnoutIndicatorKey,
  { weight: number; label: string }
> = {
  rising_friction: { weight: 20, label: "Friction trending up across recent feedback" },
  falling_confidence: { weight: 15, label: "Confidence trending down across recent feedback" },
  longer_duration: { weight: 15, label: "Tasks taking longer than prior window" },
  completion_decline: { weight: 20, label: "Completion rate dropped in the last 7 days" },
  more_failures: { weight: 10, label: "Failure rate elevated in the 7-day window" },
  more_blockers: { weight: 10, label: "Blocker rate elevated in the 7-day window" },
  inactivity_after_hard: { weight: 5, label: "Inactivity followed a hard task failure" },
  recovery_failing: { weight: 5, label: "Recent recovery task did not complete" },
};

export type BurnoutRiskAssessment = {
  score: number;
  level: BurnoutRiskLevel;
  firedIndicators: BurnoutIndicatorKey[];
  /** Shame-free system language only. */
  narrative: string;
  recommendedResponse: "observe" | "reduce_friction" | "load_reduction" | "protective_rest";
};

function isRising(values: number[], minPoints = 3): boolean {
  if (values.length < minPoints) return false;
  const tail = values.slice(-minPoints);
  for (let i = 1; i < tail.length; i++) {
    if (tail[i]! <= tail[i - 1]!) return false;
  }
  return true;
}

function isFalling(values: number[], minPoints = 3): boolean {
  if (values.length < minPoints) return false;
  const tail = values.slice(-minPoints);
  for (let i = 1; i < tail.length; i++) {
    if (tail[i]! >= tail[i - 1]!) return false;
  }
  return true;
}

function prior7DayCompletionRate(rows: RawFeedbackRow[], now: Date): number {
  const end = new Date(now.getTime() - 7 * 86400000);
  const start = new Date(end.getTime() - 7 * 86400000);
  const slice = rows.filter((r) => r.created_at >= start && r.created_at < end);
  if (slice.length === 0) return 0;
  return slice.filter((r) => r.completion_status === "completed").length / slice.length;
}

export function scoreBurnoutRisk(
  evidence: NormalizedBehaviorEvidence,
  options?: {
    inactivityAfterHardFailure?: boolean;
    recoveryTaskFailedOrSkipped?: boolean;
    now?: Date;
  },
): BurnoutRiskAssessment {
  const now = options?.now ?? new Date();
  const rows = evidence.recentFeedbackChronological;
  const frictionSeries = rows.slice(-5).map((r) => r.friction_score ?? 0);
  const confidenceSeries = rows.slice(-5).map((r) => r.confidence_score ?? 5);

  const fired: BurnoutIndicatorKey[] = [];
  let score = 0;

  if (isRising(frictionSeries)) {
    fired.push("rising_friction");
    score += BURNOUT_INDICATORS.rising_friction.weight;
  }
  if (isFalling(confidenceSeries)) {
    fired.push("falling_confidence");
    score += BURNOUT_INDICATORS.falling_confidence.weight;
  }

  const priorRate = prior7DayCompletionRate(rows, now);
  const currRate = evidence.w7.completionRate;
  if (priorRate > 0 && priorRate - currRate > 0.25) {
    fired.push("completion_decline");
    score += BURNOUT_INDICATORS.completion_decline.weight;
  }

  const priorDuration = evidence.w14.avgDurationMinutes;
  const currDuration = evidence.w7.avgDurationMinutes;
  if (priorDuration > 0 && currDuration >= priorDuration * 1.2) {
    fired.push("longer_duration");
    score += BURNOUT_INDICATORS.longer_duration.weight;
  }

  const w7Total = Math.max(1, evidence.w7.feedbackCount);
  if (evidence.w7.failedCount / w7Total > 0.4) {
    fired.push("more_failures");
    score += BURNOUT_INDICATORS.more_failures.weight;
  }
  if (evidence.w7.blockedCount / w7Total > 0.3) {
    fired.push("more_blockers");
    score += BURNOUT_INDICATORS.more_blockers.weight;
  }
  if (options?.inactivityAfterHardFailure ?? evidence.hasOpenInactivity) {
    fired.push("inactivity_after_hard");
    score += BURNOUT_INDICATORS.inactivity_after_hard.weight;
  }
  if (options?.recoveryTaskFailedOrSkipped) {
    fired.push("recovery_failing");
    score += BURNOUT_INDICATORS.recovery_failing.weight;
  }

  score = Math.min(100, Math.max(0, score));

  const level: BurnoutRiskLevel =
    score >= 75 ? "CRITICAL"
    : score >= 50 ? "HIGH"
    : score >= 25 ? "MEDIUM"
    : "LOW";

  const narrative =
    level === "CRITICAL"
      ? "Your system has entered a protected rest period with reduced load for this session."
      : level === "HIGH"
        ? "Execution load is elevated — recovery-oriented pacing and a lighter queue are recommended."
        : level === "MEDIUM"
          ? "Mild fatigue signals detected — task wording and pacing may adjust."
          : "Trajectory is stable within the current window.";

  const recommendedResponse =
    level === "CRITICAL" ? "protective_rest"
    : level === "HIGH" ? "load_reduction"
    : level === "MEDIUM" ? "reduce_friction"
    : "observe";

  return { score, level, firedIndicators: fired, narrative, recommendedResponse };
}

export function riskLevelFromScore(score: number): BurnoutRiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}
