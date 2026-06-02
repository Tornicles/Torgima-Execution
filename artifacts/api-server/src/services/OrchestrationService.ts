/**
 * Phase 6 / DOC 28 — engine ownership, conflict precedence, locks, canonical workflows.
 * Orchestration governs sequencing and recovery; engines retain domain logic.
 */

import { logger } from "../lib/logger.js";
import {
  acquireLock as acquireLockImpl,
  releaseLock as releaseLockImpl,
  type LockScope,
  LOCK_MAX_TTL_SECONDS,
  LOCK_ACQUIRE_WAIT_MS,
} from "../engines/orchestration/OrchestrationLock.js";
import { Workflows } from "../engines/orchestration/WorkflowDefinitions.js";

export type { LockScope };
export { LOCK_MAX_TTL_SECONDS, LOCK_ACQUIRE_WAIT_MS, Workflows };

/** DOC 28 — immutable engine ownership boundaries. */
export const ENGINE_OWNERSHIP = {
  FeedbackProcessing: "Feedback validation + order feedback status",
  SignalCalculation: "SignalSnapshot metrics",
  ConditionEvaluation: "Current condition + StateMemory",
  ControlEngine: "EnforcementPackage + allowed behavior",
  TaskGeneration: "Candidate tasks + order creation logic",
  TaskGuarantee: "Never-empty next-action guarantee",
  PriorityEngine: "Task value scoring + ranking",
  DependencyEngine: "Executability + blockers",
  OutcomeValidation: "OutcomeValidation + FalseProgressFlag",
  IdentityEngine: "UserIdentityState + IdentityHistory",
  RewardEngine: "RewardEvent eligibility + creation",
  PatternLearning: "BehaviorPattern records",
  FailureClassification: "Failure root cause + correction routing",
  FrictionDetection: "Friction type + adaptation routing",
  BhudhiRouter: "AI invocation contracts ONLY",
} as const;

/** DOC 28 — hardcoded conflict resolution order. */
export const CONFLICT_PRECEDENCE = [
  { winner: "ControlEngine", loser: "TaskGeneration", reason: "Tasks must obey enforcement" },
  { winner: "DependencyEngine", loser: "PriorityEngine", reason: "Blocked tasks are not executable" },
  {
    winner: "OutcomeValidation",
    loser: "RewardEngine",
    reason: "No reward for unvalidated or false progress",
  },
  { winner: "StateMutationService", loser: "BhudhiRouter", reason: "Stale AI output is invalid" },
  {
    winner: "StateIntegrityValidator",
    loser: "NormalExecution",
    reason: "Unsafe state must be repaired first",
  },
] as const;

export type ConflictPrecedenceRule = (typeof CONFLICT_PRECEDENCE)[number];

export interface OrchestrationConflictDecision {
  winner: string;
  loser: string;
  reason: string;
}

/** DOC 28 — numeric priority when no explicit precedence row matches (higher wins). */
const ENGINE_PRIORITY: Record<string, number> = {
  BHUDHI: 1,
  REWARD_ENGINE: 2,
  REWARD: 2,
  DEPENDENCY_ENGINE: 3,
  DEPENDENCY: 3,
  TASK_GENERATION: 4,
  CONDITION_ENGINE: 8,
  CONDITION: 8,
  SIGNAL_ENGINE: 9,
  SIGNAL: 9,
  OUTCOME_TRUTH: 9,
  OUTCOME_VALIDATION: 9,
  CONTROL_ENGINE: 10,
  CONTROL: 10,
};

function enginePriority(engine: string): number {
  const upper = engine.toUpperCase();
  const bare = upper.replace(/_ENGINE$/, "");
  return (
    ENGINE_PRIORITY[upper] ??
    ENGINE_PRIORITY[`${bare}_ENGINE`] ??
    ENGINE_PRIORITY[bare] ??
    5
  );
}

/** Resolve which engine wins when both claim authority. */
export function resolveConflictFromPrecedence(
  engineA: string,
  engineB: string,
): OrchestrationConflictDecision {
  const normalize = (e: string) => e.replace(/Engine$/, "").toLowerCase();

  for (const rule of CONFLICT_PRECEDENCE) {
    const w = normalize(rule.winner);
    const l = normalize(rule.loser);
    const a = normalize(engineA);
    const b = normalize(engineB);
    if ((a === w && b === l) || (a === l && b === w)) {
      const winner = a === w ? engineA : engineB;
      const loser = winner === engineA ? engineB : engineA;
      return { winner, loser, reason: rule.reason };
    }
  }

  const priorityA = enginePriority(engineA);
  const priorityB = enginePriority(engineB);
  if (priorityA !== priorityB) {
    const winner = priorityA > priorityB ? engineA : engineB;
    return {
      winner,
      loser: winner === engineA ? engineB : engineA,
      reason: "Engine priority table — higher precedence wins",
    };
  }

  return {
    winner: engineA,
    loser: engineB,
    reason: "No explicit precedence rule — first claimant wins",
  };
}

export async function acquireLock(
  scope: LockScope,
  entityId: string,
  ttlSeconds = LOCK_MAX_TTL_SECONDS,
  options?: {
    workflowName?: string;
    waitMs?: number;
    causationEventId?: string;
    userId?: string;
    blueprintId?: string;
  },
): Promise<boolean> {
  return acquireLockImpl(scope, entityId, ttlSeconds, options);
}

export async function releaseLock(
  scope: LockScope,
  entityId: string,
  workflowName?: string,
): Promise<void> {
  return releaseLockImpl(scope, entityId, workflowName);
}

/** Blueprint-scoped lock for feedback / task-generation workflows. */
export async function acquireBlueprintWorkflowLock(
  blueprintId: string,
  workflowName: string,
  options?: { causationEventId?: string; userId?: string },
): Promise<boolean> {
  return acquireLock("BLUEPRINT", blueprintId, LOCK_MAX_TTL_SECONDS, {
    workflowName,
    ...options,
  });
}

export async function releaseBlueprintWorkflowLock(
  blueprintId: string,
  workflowName: string,
): Promise<void> {
  return releaseLock("BLUEPRINT", blueprintId, workflowName);
}

export function engineOwns(engine: keyof typeof ENGINE_OWNERSHIP): string {
  return ENGINE_OWNERSHIP[engine];
}

export function listCanonicalWorkflows(): typeof Workflows {
  return Workflows;
}

export function logOwnershipViolation(params: {
  engine: string;
  attemptedAction: string;
  owner: string;
}): void {
  logger.warn(
    params,
    "[OrchestrationService] Engine attempted action outside ownership boundary",
  );
}
