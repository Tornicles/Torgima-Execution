export type Doc11InactivityType =
  | "TASK_TOO_HARD"
  | "TASK_UNCLEAR"
  | "LIFE_EVENT"
  | "LOSING_MOMENTUM"
  | "WRONG_WORK"
  | "UNKNOWN";

export type ClassificationConfidence = "high" | "medium" | "low";

export type InactivityClassification = {
  inactivity_type: Doc11InactivityType;
  confidence: ClassificationConfidence;
};

export type InactivityEvidenceContext = {
  lastOrderDifficulty?: string | null;
  lastFeedbackScore?: number | null;
  lastCompletionStatus?: string | null;
  lastBlockerCategory?: string | null;
  hadRecentFriction?: boolean;
  consistencyRate?: number;
  signalTrend?: "declining" | "stable" | "rising" | null;
  completionRateTrend?: "dropping" | "stable" | "rising" | null;
  openFalseProgressFlags?: number;
  lowOutcomeMovement?: boolean;
};

export function classifyInactivityReason(
  evidence: InactivityEvidenceContext,
): InactivityClassification {
  if ((evidence.openFalseProgressFlags ?? 0) > 0 || evidence.lowOutcomeMovement) {
    return { inactivity_type: "WRONG_WORK", confidence: "high" };
  }

  const difficulty = String(evidence.lastOrderDifficulty ?? "").toLowerCase();
  const hard = difficulty === "hard" || difficulty === "very_hard";
  const lowScore = (evidence.lastFeedbackScore ?? 10) <= 4;
  const hadBlocker = evidence.lastCompletionStatus === "blocked" || evidence.hadRecentFriction;

  if (hard && (lowScore || hadBlocker)) {
    return { inactivity_type: "TASK_TOO_HARD", confidence: "high" };
  }

  if (
    evidence.lastBlockerCategory === "CLARITY_NEEDED" ||
    (evidence.lastCompletionStatus === "blocked" &&
      String(evidence.lastBlockerCategory ?? "").includes("CLARITY"))
  ) {
    return { inactivity_type: "TASK_UNCLEAR", confidence: "high" };
  }

  if (
    (evidence.consistencyRate ?? 0) >= 0.8 &&
    !evidence.hadRecentFriction &&
    !hard
  ) {
    return { inactivity_type: "LIFE_EVENT", confidence: "medium" };
  }

  if (
    evidence.signalTrend === "declining" ||
    evidence.completionRateTrend === "dropping"
  ) {
    return { inactivity_type: "LOSING_MOMENTUM", confidence: "medium" };
  }

  return { inactivity_type: "UNKNOWN", confidence: "low" };
}
