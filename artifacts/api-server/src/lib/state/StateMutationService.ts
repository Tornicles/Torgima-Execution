/**
 * DOC15 — state mutation facade.
 * Canonical implementation lives in services/StateMutationService.ts.
 */
export {
  applyMutation,
  mutate,
  assertBlueprintVersion,
  appendBlueprintVersionAudit,
  getCurrentStateVersion,
  incrementStateVersion,
  type MutationSource,
  type MutationResult,
  type StateMutationRequest,
  type StateMutationResponse,
  type StateMutationResult,
} from "../../services/StateMutationService.js";

import {
  applyMutation as applyMutationCore,
  getCurrentStateVersion,
  type StateMutationResponse,
} from "../../services/StateMutationService.js";
import { TorgimaError } from "../errors.js";

type Tx = Parameters<Parameters<typeof import("@workspace/db").db.transaction>[0]>[0];

/** DOC15 shorthand — version-checked mutation with stale → STALE_STATE throw. */
export async function applyVersionedMutation<TData>(
  params: {
    userId: string;
    blueprintId: string;
    expectedStateVersion?: number;
    mutationType: string;
    entityType: string;
    entityId: string;
    idempotencyKey: string;
    causationEventId?: string;
    payload?: Record<string, unknown>;
  },
  mutator: (tx: Tx, currentVersion: number) => Promise<TData>,
): Promise<StateMutationResponse<TData>> {
  const currentVersion = await getCurrentStateVersion(params.blueprintId);
  const expectedStateVersion =
    params.expectedStateVersion !== undefined ? params.expectedStateVersion : currentVersion;

  return applyMutationCore(
    {
      userId: params.userId,
      blueprintId: params.blueprintId,
      source: "USER_ACTION",
      mutationType: params.mutationType,
      expectedStateVersion,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload ?? {},
      idempotencyKey: params.idempotencyKey,
      causationEventId: params.causationEventId,
    },
    mutator,
  );
}

/** Map REJECTED_STALE to TorgimaError for route handlers. */
export function throwIfStaleMutation<TData>(
  response: StateMutationResponse<TData>,
  fallbackMessage = "State changed. Refresh and retry.",
): TData {
  if (response.result === "REJECTED_STALE") {
    throw new TorgimaError(
      "STALE_STATE",
      response.errors?.[0] ?? fallbackMessage,
      true,
    );
  }
  if (!response.ok || response.result !== "APPLIED") {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      response.errors?.[0] ?? "State mutation failed",
      false,
    );
  }
  return response.data as TData;
}
