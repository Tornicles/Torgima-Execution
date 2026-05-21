import { db, blueprints, blueprintMutations, blueprintVersions } from "@workspace/db";
import { eq, and, like, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { TorgimaError } from "../lib/errors.js";
import { writeEventInTx, writeEvent, EVENT_TYPES } from "./EventService.js";

// StateMutationService — the only approved write path for blueprint-scoped state.
// Enforces: version check, transaction, version increment, mutation audit, event outbox.
//
// Spec: Prompt 6 §STEP 1, DOC_15 §10–13, §15.

export type MutationSource = "USER_ACTION" | "ENGINE" | "WORKER" | "ADMIN" | "SYSTEM_REPAIR";

export type MutationResult =
  | "APPLIED"
  | "REJECTED_STALE"
  | "REJECTED_PERMISSION"
  | "REJECTED_VALIDATION"
  | "NOOP_DUPLICATE";

export interface StateMutationRequest<TPayload = Record<string, unknown>> {
  userId: string;
  blueprintId: string;
  source: MutationSource;
  mutationType: string;
  expectedStateVersion: number;
  entityType: string;
  entityId: string;
  payload: TPayload;
  causationEventId?: string;
  idempotencyKey: string;
}

export interface StateMutationResponse<TData = unknown> {
  ok: boolean;
  result: MutationResult;
  previousStateVersion: number;
  newStateVersion?: number;
  data?: TData;
  errors?: string[];
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** GAP G4 — optimistic version lock; throws STALE_STATE on conflict. */
export async function mutate<T>(params: {
  blueprintId: string;
  userId: string;
  expectedVersion: number;
  mutationName: string;
  mutationFn: (tx: Tx) => Promise<T>;
  source?: MutationSource;
  idempotencyKey?: string;
  causationEventId?: string;
}): Promise<{ result: T; newVersion: number }> {
  const response = await applyMutation<Record<string, unknown>, T>(
    {
      userId: params.userId,
      blueprintId: params.blueprintId,
      source: params.source ?? "ENGINE",
      mutationType: params.mutationName,
      expectedStateVersion: params.expectedVersion,
      entityType: "blueprint",
      entityId: params.blueprintId,
      payload: { mutation_name: params.mutationName },
      idempotencyKey:
        params.idempotencyKey ??
        `mutate:${params.mutationName}:${params.blueprintId}:v${params.expectedVersion}`,
      causationEventId: params.causationEventId,
    },
    async (tx, _currentVersion) => params.mutationFn(tx),
  );

  if (response.result === "REJECTED_STALE") {
    throw new TorgimaError(
      "STALE_STATE",
      response.errors?.[0] ??
        `Expected version ${params.expectedVersion} but blueprint state has advanced`,
      true,
    );
  }
  if (response.result === "REJECTED_PERMISSION") {
    throw new TorgimaError("FORBIDDEN", response.errors?.[0] ?? "Blueprint not found", false);
  }
  if (!response.ok || response.result !== "APPLIED") {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      response.errors?.[0] ?? "State mutation failed",
      false,
    );
  }

  return {
    result: response.data as T,
    newVersion: response.newStateVersion ?? params.expectedVersion + 1,
  };
}

/** Reject if blueprint version changed since read (use inside an open transaction). */
export async function assertBlueprintVersion(
  tx: Tx,
  blueprintId: string,
  expectedVersion: number,
): Promise<void> {
  const [bp] = await tx
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  if (!bp) throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);
  if (bp.state_version !== expectedVersion) {
    throw new TorgimaError(
      "STALE_STATE",
      `Expected version ${expectedVersion} but current is ${bp.state_version}`,
      true,
    );
  }
}

export async function appendBlueprintVersionAudit(
  tx: Tx,
  params: {
    blueprintId: string;
    userId: string;
    previousVersion: number;
    newVersion: number;
    mutationName: string;
    layer?: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(blueprintVersions).values({
    blueprint_id: params.blueprintId,
    version_number: params.newVersion,
    change_type: params.mutationName,
    affected_layer: params.layer ?? "blueprint",
    before_state: { state_version: params.previousVersion, ...(params.beforeState ?? {}) },
    after_state: { state_version: params.newVersion, ...(params.afterState ?? {}) },
    triggered_by: params.userId,
  });
}

// Core mutation wrapper.
// Enforces: ownership → idempotency → version check → transaction → version increment → event emit.
export async function applyMutation<TPayload, TData>(
  request: StateMutationRequest<TPayload>,
  mutator: (tx: Tx, currentVersion: number) => Promise<TData>,
): Promise<StateMutationResponse<TData>> {
  // 1. Load current blueprint + ownership check
  const [blueprint] = await db
    .select({
      id: blueprints.id,
      state_version: blueprints.state_version,
    })
    .from(blueprints)
    .where(and(eq(blueprints.id, request.blueprintId), eq(blueprints.user_id, request.userId)))
    .limit(1);

  if (!blueprint) {
    return {
      ok: false,
      result: "REJECTED_PERMISSION",
      previousStateVersion: 0,
      errors: ["Blueprint not found or not owned by user"],
    };
  }

  // 2. Idempotency check — reuse blueprint_mutations.change_summary as the carrier
  const [existingMutation] = await db
    .select({ id: blueprintMutations.id })
    .from(blueprintMutations)
    .where(
      and(
        eq(blueprintMutations.blueprint_id, request.blueprintId),
        like(blueprintMutations.change_summary, `%key:${request.idempotencyKey}%`),
      ),
    )
    .limit(1);

  if (existingMutation) {
    return {
      ok: true,
      result: "NOOP_DUPLICATE",
      previousStateVersion: blueprint.state_version,
      newStateVersion: blueprint.state_version,
    };
  }

  // 3. Stale write check
  if (request.expectedStateVersion !== blueprint.state_version) {
    logger.warn(
      {
        blueprintId: request.blueprintId,
        expected: request.expectedStateVersion,
        current: blueprint.state_version,
        mutationType: request.mutationType,
      },
      "[StateMutation] Stale write rejected",
    );
    return {
      ok: false,
      result: "REJECTED_STALE",
      previousStateVersion: request.expectedStateVersion,
      newStateVersion: blueprint.state_version,
      errors: [
        `State changed. Expected version ${request.expectedStateVersion}, current is ${blueprint.state_version}. Refresh and retry.`,
      ],
    };
  }

  const previousVersion = blueprint.state_version;
  const newVersion = previousVersion + 1;

  // 4. Transaction: run user mutator, increment version, write audit row, emit state_changed
  try {
    let mutatorData!: TData;

    await db.transaction(async (tx) => {
      mutatorData = await mutator(tx, previousVersion);

      const [versionRow] = await tx
        .update(blueprints)
        .set({ state_version: newVersion })
        .where(
          and(
            eq(blueprints.id, request.blueprintId),
            eq(blueprints.state_version, previousVersion),
          ),
        )
        .returning({ id: blueprints.id });

      if (!versionRow) {
        throw new TorgimaError(
          "STALE_STATE",
          `Concurrent mutation on blueprint ${request.blueprintId}`,
          true,
        );
      }

      await appendBlueprintVersionAudit(tx, {
        blueprintId: request.blueprintId,
        userId: request.userId,
        previousVersion,
        newVersion,
        mutationName: request.mutationType,
        layer: request.entityType,
        afterState: { mutation_type: request.mutationType, source: request.source },
      });

      // Structural / execution-level audit row
      const category = deriveMutationCategory(request.mutationType);
      if (["STRUCTURAL", "EXECUTION", "CONDITION", "CONTROL"].includes(category)) {
        await tx.insert(blueprintMutations).values({
          blueprint_id: request.blueprintId,
          mutation_type: request.mutationType,
          layer: request.entityType,
          entity_id: request.entityId as unknown as undefined,
          change_summary: `${request.mutationType} on ${request.entityType}:${request.entityId} | key:${request.idempotencyKey}`,
          approved: true,
          approved_at: new Date(),
        });
      }

      await writeEventInTx(
        {
          eventType: EVENT_TYPES.STATE_CHANGED,
          entityType: request.entityType,
          entityId: request.entityId,
          userId: request.userId,
          blueprintId: request.blueprintId,
          payload: {
            mutation_type: request.mutationType,
            previous_version: previousVersion,
            new_version: newVersion,
            source: request.source,
          },
          idempotencyKey: `state_changed:${request.blueprintId}:${newVersion}`,
          causationEventId: request.causationEventId,
        },
        tx,
      );
    });

    logger.debug(
      {
        blueprintId: request.blueprintId,
        mutationType: request.mutationType,
        from: previousVersion,
        to: newVersion,
      },
      "[StateMutation] Applied",
    );

    return {
      ok: true,
      result: "APPLIED",
      previousStateVersion: previousVersion,
      newStateVersion: newVersion,
      data: mutatorData,
    };
  } catch (error) {
    if (error instanceof TorgimaError && error.code === "STALE_STATE") {
      return {
        ok: false,
        result: "REJECTED_STALE",
        previousStateVersion: previousVersion,
        newStateVersion: blueprint.state_version,
        errors: [error.message],
      };
    }

    logger.error(
      {
        blueprintId: request.blueprintId,
        mutationType: request.mutationType,
        error: error instanceof Error ? error.message : String(error),
      },
      "[StateMutation] Transaction failed",
    );

    return {
      ok: false,
      result: "REJECTED_VALIDATION",
      previousStateVersion: previousVersion,
      errors: [error instanceof Error ? error.message : "Transaction failed"],
    };
  }
}

// Lightweight version probe for read paths that need to confirm freshness.
export async function getCurrentStateVersion(blueprintId: string): Promise<number> {
  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return bp?.state_version ?? 0;
}

// Engine-only force-increment. Used when an engine writes immutable snapshot rows
// (signal, condition, enforcement) and needs to bump the canonical state pointer
// without going through the full applyMutation contract.
export async function incrementStateVersion(
  blueprintId: string,
  reason: string,
  causationEventId?: string,
  tx?: Tx,
): Promise<number> {
  const client = (tx ?? db) as typeof db;

  const [before] = await client
    .select({ state_version: blueprints.state_version, user_id: blueprints.user_id })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  if (!before) return 0;

  const previousVersion = before.state_version;
  const newVersion = previousVersion + 1;

  const runIncrement = async (innerTx: Tx) => {
    const [updated] = await innerTx
      .update(blueprints)
      .set({ state_version: newVersion })
      .where(
        and(eq(blueprints.id, blueprintId), eq(blueprints.state_version, previousVersion)),
      )
      .returning({ state_version: blueprints.state_version, user_id: blueprints.user_id });

    if (!updated) {
      throw new TorgimaError(
        "STALE_STATE",
        `Version conflict incrementing blueprint ${blueprintId}`,
        true,
      );
    }

    await appendBlueprintVersionAudit(innerTx, {
      blueprintId,
      userId: updated.user_id,
      previousVersion,
      newVersion: updated.state_version,
      mutationName: reason,
    });

    return updated;
  };

  const updated = tx
    ? await runIncrement(tx)
    : await db.transaction(async (innerTx) => runIncrement(innerTx));

  if (!updated) return 0;

  // When called outside an existing transaction, emit the state_changed event eagerly
  // so projection refresh runs even if the caller never wrote one.
  if (!tx) {
    await writeEvent({
      eventType: EVENT_TYPES.STATE_CHANGED,
      entityType: "blueprint",
      entityId: blueprintId,
      userId: updated.user_id,
      blueprintId,
      payload: { reason, new_version: updated.state_version },
      idempotencyKey: `state_changed:${blueprintId}:${updated.state_version}`,
      causationEventId,
    }).catch(() => null);
  }

  return updated.state_version;
}

function deriveMutationCategory(mutationType: string): string {
  if (["CREATE", "UPDATE", "COMPLETE", "REORDER"].includes(mutationType)) return "STRUCTURAL";
  if (["FEEDBACK", "ORDER_STATUS"].includes(mutationType)) return "EXECUTION";
  if (["CONDITION_CHANGE"].includes(mutationType)) return "CONDITION";
  if (["ENFORCEMENT_UPDATE"].includes(mutationType)) return "CONTROL";
  return "OTHER";
}
