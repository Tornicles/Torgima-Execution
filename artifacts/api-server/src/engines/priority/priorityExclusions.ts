/**
 * Phase 5 / DOC 24 — priority exclusion rules (order enforced in PriorityEngine.rankCandidates).
 */

import type { PriorityCandidate } from "./PriorityEngine.js";

export const TASK_TYPE_TO_ALLOWED_ACTION: Record<string, string> = {
  execution: "task_execution",
  recovery: "task_execution",
  blocker_resolution: "task_execution",
  academy: "academy_tasks",
  clarification: "feedback_submission",
  review: "task_execution",
  habit: "habit_checkins",
};

export function isTaskTypeAllowed(
  taskType: string,
  allowedActions: string[],
): boolean {
  const required = TASK_TYPE_TO_ALLOWED_ACTION[taskType] ?? "task_execution";
  const normalized = allowedActions.map((a) => a.toLowerCase());
  return normalized.includes(required.toLowerCase());
}

export function isDuplicateContentHash(
  candidate: PriorityCandidate,
  recentHashes: Set<string>,
): boolean {
  if (!candidate.content_hash) return false;
  return recentHashes.has(candidate.content_hash);
}

export function isDependencyBlocked(
  candidate: PriorityCandidate,
  blockedOrderIds: Set<string>,
): boolean {
  if (!candidate.id) return false;
  return blockedOrderIds.has(candidate.id);
}
