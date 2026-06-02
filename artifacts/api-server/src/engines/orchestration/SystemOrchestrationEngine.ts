import {
  acquireBlueprintLock,
  releaseBlueprintLock,
  blueprintLockKey,
  acquireLock,
  releaseLock,
} from "./OrchestrationLock.js";
import {
  CONFLICT_PRECEDENCE,
  resolveConflictFromPrecedence,
  ENGINE_OWNERSHIP,
} from "../../services/OrchestrationService.js";

export { CONFLICT_PRECEDENCE, ENGINE_OWNERSHIP, resolveConflictFromPrecedence };

export type ConflictType =
  | "TASK_CONFLICT"
  | "STATE_CONFLICT"
  | "PERMISSION_CONFLICT"
  | "EXECUTION_CONFLICT";

export interface OrchestrationDecision {
  winner:     string;
  loser:      string;
  reason:     string;
  resolution: string;
}

export function resolveConflict(params: {
  engineA:      string;
  engineB:      string;
  conflictType: ConflictType;
  context?:     string;
}): OrchestrationDecision {
  void params.context;
  const decided = resolveConflictFromPrecedence(params.engineA, params.engineB);

  const resolutionMap: Record<ConflictType, string> = {
    TASK_CONFLICT:       "Winner's task rules apply. Loser's task is suppressed.",
    STATE_CONFLICT:      "Winner's state version wins. Loser must re-read current state.",
    PERMISSION_CONFLICT: "Winner's permission rules apply. Loser action is blocked.",
    EXECUTION_CONFLICT:  "Winner's execution path is followed. Loser emits deferred event.",
  };

  return {
    winner: decided.winner,
    loser: decided.loser,
    reason: decided.reason,
    resolution: resolutionMap[params.conflictType],
  };
}

export async function acquireOrchestrationLock(params: {
  blueprintId: string;
  scope:       string;
  ttlMs?:      number;
}): Promise<boolean> {
  return acquireBlueprintLock(params.blueprintId, params.scope, params.ttlMs ?? 5000);
}

export async function releaseOrchestrationLock(params: {
  blueprintId: string;
  scope:       string;
}): Promise<void> {
  return releaseBlueprintLock(params.blueprintId, params.scope);
}

export { blueprintLockKey, acquireLock, releaseLock };
