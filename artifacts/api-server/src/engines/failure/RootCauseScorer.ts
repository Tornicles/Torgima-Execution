/**
 * DOC22 Task 2 — score all 10 failure categories from evidence signals.
 */

import { FAILURE_CATEGORIES, type FailureCategory } from "./failureTypes.js";
import type { FailureEvidence } from "./FailureEvidence.js";

export type CategoryScore = {
  category: FailureCategory;
  score: number;
};

const HARD_DIFFICULTIES = new Set(["hard", "very_hard"]);
const BEGINNER_HANDLING = new Set(["beginner", "intermediate", "easy"]);

function containsAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

export function scoreAll(evidence: FailureEvidence): CategoryScore[] {
  const scores: Record<FailureCategory, number> = Object.fromEntries(
    FAILURE_CATEGORIES.map((c) => [c, 0]),
  ) as Record<FailureCategory, number>;

  const reflection = evidence.reflection.toLowerCase();

  if (containsAny(reflection, ["unclear", "confused", "unsure", "confusing", "didn't know", "didnt know"])) {
    scores.CLARITY_FAILURE += 30;
  }
  if (evidence.proofRequired && !evidence.proofDescription) {
    scores.CLARITY_FAILURE += 25;
  }
  if (evidence.blockerCategory === "CLARITY_NEEDED") {
    scores.CLARITY_FAILURE += 20;
  }
  if ((evidence.score ?? 10) <= 2 && !evidence.blockerJson) {
    scores.CLARITY_FAILURE += 15;
  }

  const diff = (evidence.orderDifficulty ?? "moderate").toLowerCase();
  if (HARD_DIFFICULTIES.has(diff) && BEGINNER_HANDLING.has((evidence.difficultyHandling ?? "").toLowerCase())) {
    scores.CAPABILITY_FAILURE += 35;
  }
  if (evidence.hardFailures14d >= 2) {
    scores.CAPABILITY_FAILURE += 25;
  }
  if (
    evidence.completionStatus === "failed" &&
    HARD_DIFFICULTIES.has(diff)
  ) {
    scores.CAPABILITY_FAILURE += 15;
  }

  if ((evidence.durationMinutes ?? 0) > 120) {
    scores.CAPACITY_FAILURE += 30;
  }
  if (evidence.consistency7d < 40 && evidence.conditionName !== "nothingness") {
    scores.CAPACITY_FAILURE += 25;
  }
  if (evidence.fatigueRiskPatternActive) {
    scores.CAPACITY_FAILURE += 20;
  }

  const depBlockers = new Set(["DEPENDENCY_MISSING", "EXTERNAL_WAIT", "RESOURCE_MISSING"]);
  if (
    evidence.completionStatus === "blocked" &&
    evidence.blockerCategory &&
    depBlockers.has(evidence.blockerCategory)
  ) {
    scores.DEPENDENCY_FAILURE += 40;
  }
  if (evidence.blockerJson && Object.keys(evidence.blockerJson).length > 0 && scores.DEPENDENCY_FAILURE === 0) {
    scores.DEPENDENCY_FAILURE += 20;
  }

  if (evidence.completionStatus === "skipped" && evidence.reflection.length < 15) {
    scores.MOTIVATION_FRICTION += 30;
  }
  if (evidence.taskTypeAvoidanceActive) {
    scores.MOTIVATION_FRICTION += 25;
  }
  if (containsAny(reflection, ["dont want", "don't want", "boring", "pointless"])) {
    scores.MOTIVATION_FRICTION += 20;
  }

  if (evidence.stateIntegrityIssueRecent) {
    scores.SYSTEM_FRICTION += 40;
  }
  if (evidence.orderRegenerationCount >= 2) {
    scores.SYSTEM_FRICTION += 30;
  }
  if (containsAny(reflection, ["app", "system", "error", "bug"])) {
    scores.SYSTEM_FRICTION += 20;
  }
  if (evidence.gamingFlag) {
    scores.SYSTEM_FRICTION += 15;
  }

  if (evidence.falseProgressScore > 60 && evidence.completionStatus === "completed") {
    scores.WRONG_PRIORITY += 35;
  }
  if (evidence.falseProgressFlagType === "WRONG_WORK") {
    scores.WRONG_PRIORITY += 25;
  }

  if (evidence.outcomeMovementScore < 15 && evidence.completionStatus === "completed") {
    scores.OUTCOME_MISMATCH += 40;
  }
  if (evidence.activeSpecLabels.includes("LOW_VALUE_COMPLETION")) {
    scores.OUTCOME_MISMATCH += 25;
  }

  if (evidence.blockerCategory === "EXTERNAL_WAIT") {
    scores.EXTERNAL_BLOCKER += 40;
  }
  if (containsAny(reflection, ["client", "supplier", "waiting", "approval", "response"])) {
    scores.EXTERNAL_BLOCKER += 30;
  }

  const rejection = (evidence.rejectionReason ?? "").toLowerCase();
  if (
    (evidence.validationStatus ?? "").toLowerCase() === "rejected" &&
    (rejection.includes("proof") || rejection.includes("evidence"))
  ) {
    scores.PROOF_FAILURE += 40;
  }
  if (
    evidence.proofRequired &&
    evidence.completionStatus === "failed" &&
    (!evidence.proofJson || Object.keys(evidence.proofJson as object).length === 0)
  ) {
    scores.PROOF_FAILURE += 25;
  }

  const ranked = FAILURE_CATEGORIES.map((category) => ({
    category,
    score: Math.min(100, scores[category]),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return [{ category: "CLARITY_FAILURE", score: 20 }];
  }

  return ranked;
}

export function confidenceFromReflection(length: number): "LOW" | "MEDIUM" | "HIGH" {
  if (length > 50) return "HIGH";
  if (length > 20) return "MEDIUM";
  return "LOW";
}

export function baseSeverityFromScore(topScore: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (topScore >= 80) return "CRITICAL";
  if (topScore >= 60) return "HIGH";
  if (topScore >= 30) return "MEDIUM";
  return "LOW";
}

export function escalateSeverityLevel(
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  const idx = order.indexOf(severity);
  return order[Math.min(order.length - 1, idx + 1)] ?? severity;
}
