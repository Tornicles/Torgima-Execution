import { db, events } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

const ENGINE_PRECEDENCE: Record<string, number> = {
  CONTROL_ENGINE:    1,
  DEPENDENCY_ENGINE: 2,
  CONDITION_ENGINE:  3,
  OUTCOME_TRUTH:     4,
  SIGNAL_ENGINE:     5,
  PATTERN_ENGINE:    6,
  TASK_GENERATION:   7,
  REWARD_ENGINE:     8,
  BHUDHI:            9,
  IDENTITY_ENGINE:   10,
};

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
  const precA = ENGINE_PRECEDENCE[params.engineA] ?? 99;
  const precB = ENGINE_PRECEDENCE[params.engineB] ?? 99;

  const winner = precA <= precB ? params.engineA : params.engineB;
  const loser = winner === params.engineA ? params.engineB : params.engineA;
  const winnerPrec = precA <= precB ? precA : precB;
  const loserPrec = precA <= precB ? precB : precA;

  const resolutionMap: Record<ConflictType, string> = {
    TASK_CONFLICT:       "Winner's task rules apply. Loser's task is suppressed.",
    STATE_CONFLICT:      "Winner's state version wins. Loser must re-read current state.",
    PERMISSION_CONFLICT: "Winner's permission rules apply. Loser action is blocked.",
    EXECUTION_CONFLICT:  "Winner's execution path is followed. Loser emits deferred event.",
  };

  return {
    winner,
    loser,
    reason:     `${winner} (precedence ${winnerPrec}) outranks ${loser} (precedence ${loserPrec})`,
    resolution: resolutionMap[params.conflictType],
  };
}

export async function acquireOrchestrationLock(params: {
  blueprintId: string;
  scope:       string;
  ttlMs?:      number;
}): Promise<boolean> {
  const lockKey = `lock:${params.blueprintId}:${params.scope}`;
  const ttl = params.ttlMs ?? 5000;
  const expiresAt = new Date(Date.now() + ttl);

  const [inserted] = await db
    .insert(events)
    .values({
      event_type:      "ORCHESTRATION_LOCK",
      entity_type:     "blueprint",
      entity_id:       params.blueprintId,
      blueprint_id:    params.blueprintId,
      idempotency_key: lockKey,
      payload:         { scope: params.scope, expires_at: expiresAt.toISOString() },
      process_after:   expiresAt,
      status:          "claimed",
    })
    .onConflictDoNothing({ target: events.idempotency_key })
    .returning({ id: events.id });

  return !!inserted;
}

export async function releaseOrchestrationLock(params: {
  blueprintId: string;
  scope:       string;
}): Promise<void> {
  const lockKey = `lock:${params.blueprintId}:${params.scope}`;
  try {
    await db
      .update(events)
      .set({ status: "processed" })
      .where(and(eq(events.idempotency_key, lockKey), eq(events.status, "claimed")));
  } catch (err) {
    logger.debug({ err }, "[Orchestration] release lock failed");
  }
}
