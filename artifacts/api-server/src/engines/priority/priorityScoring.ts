/**
 * Phase 5 / DOC 24 — legacy exports delegating to TaskValueScorer.
 */

import type { PriorityCandidate, PriorityContext } from "./PriorityEngine.js";
import {
  computeLegacyTaskValueScore,
  score,
  TASK_VALUE_WEIGHTS,
} from "./TaskValueScorer.js";

export const SIGNAL_URGENCY_WEIGHTS: Record<string, number> = {
  nothingness: 0.3,
  danger: 0.9,
  urgency: 0.7,
  stability: 0.5,
  power: 0.4,
  affluence: 0.3,
};

export function signalUrgencyForCondition(condition: string): number {
  return SIGNAL_URGENCY_WEIGHTS[condition] ?? SIGNAL_URGENCY_WEIGHTS.stability!;
}

export function blueprintAlignmentScore(_candidate: PriorityCandidate): number {
  return 0.7;
}

export function capabilityMatchScore(
  candidate: PriorityCandidate,
  context: PriorityContext,
): number {
  const DIFFICULTY_RANK: Record<string, number> = {
    very_easy: 1,
    easy: 2,
    moderate: 3,
    hard: 4,
    very_hard: 5,
  };
  const rec = context.capability?.difficulty_recommendation ?? "moderate";
  const orderDiff = candidate.difficulty ?? "moderate";
  const recRank = DIFFICULTY_RANK[rec] ?? 3;
  const orderRank = DIFFICULTY_RANK[orderDiff] ?? 3;
  const delta = Math.abs(recRank - orderRank);
  return Math.max(0, 1 - delta * 0.25);
}

export function timeSensitivityScore(candidate: PriorityCandidate): number {
  if (!candidate.due_date) return 0.5;
  const due = new Date(candidate.due_date).getTime();
  const days = (due - Date.now()) / 86400000;
  if (days <= 0) return 1;
  if (days <= 1) return 0.9;
  if (days <= 3) return 0.7;
  if (days <= 7) return 0.5;
  return 0.3;
}

export function difficultyProgressionScore(candidate: PriorityCandidate): number {
  const DIFFICULTY_RANK: Record<string, number> = {
    very_easy: 1,
    easy: 2,
    moderate: 3,
    hard: 4,
    very_hard: 5,
  };
  const rank = DIFFICULTY_RANK[candidate.difficulty ?? "moderate"] ?? 3;
  return Math.min(1, rank / 5);
}

/** DOC 24 weighted task value (0–1 scale). */
export function computeTaskValueScore(
  candidate: PriorityCandidate,
  context: PriorityContext,
): number {
  return computeLegacyTaskValueScore(candidate, context);
}

export function taskValueScoreToRank(score: number): number {
  return Math.round(score * 100);
}

export function isRecoveryPriorityOverride(
  candidate: PriorityCandidate,
  condition: string,
): boolean {
  return (
    candidate.task_type === "recovery" &&
    (condition === "danger" || condition === "nothingness")
  );
}

export { TASK_VALUE_WEIGHTS, score as scoreTaskValueComposite };
