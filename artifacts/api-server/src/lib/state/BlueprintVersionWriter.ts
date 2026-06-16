import {
  appendBlueprintVersionAudit as appendAudit,
  type MutationSource,
} from "../../services/StateMutationService.js";

type Tx = Parameters<Parameters<typeof import("@workspace/db").db.transaction>[0]>[0];

export interface BlueprintVersionWriteParams {
  blueprintId: string;
  userId: string;
  previousVersion: number;
  newVersion: number;
  mutationName: string;
  layer?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  source?: MutationSource;
}

/** DOC15 — canonical writer for blueprint_versions audit rows. */
export async function writeBlueprintVersion(
  tx: Tx,
  params: BlueprintVersionWriteParams,
): Promise<void> {
  await appendAudit(tx, {
    blueprintId: params.blueprintId,
    userId: params.userId,
    previousVersion: params.previousVersion,
    newVersion: params.newVersion,
    mutationName: params.mutationName,
    layer: params.layer,
    beforeState: {
      ...(params.beforeState ?? {}),
      ...(params.source ? { mutation_source: params.source } : {}),
    },
    afterState: params.afterState,
  });
}

export { appendAudit as appendBlueprintVersionAudit };
