import { db, blueprintVersions } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function nextBlueprintVersionNumber(tx: DbTx, blueprintId: string): Promise<number> {
  const [row] = await tx
    .select({ vn: blueprintVersions.version_number })
    .from(blueprintVersions)
    .where(eq(blueprintVersions.blueprint_id, blueprintId))
    .orderBy(desc(blueprintVersions.version_number))
    .limit(1);
  return (row?.vn ?? 0) + 1;
}

export async function recordBlueprintVersion(
  tx: DbTx,
  params: {
    blueprintId: string;
    changeType: string;
    affectedLayer: string;
    beforeState: Record<string, unknown>;
    afterState: Record<string, unknown>;
    triggeredBy: string;
    versionNumber?: number;
  },
): Promise<void> {
  const versionNumber = params.versionNumber ?? (await nextBlueprintVersionNumber(tx, params.blueprintId));

  await tx.insert(blueprintVersions).values({
    blueprint_id: params.blueprintId,
    version_number: versionNumber,
    change_type: params.changeType,
    affected_layer: params.affectedLayer,
    before_state: params.beforeState,
    after_state: params.afterState,
    triggered_by: params.triggeredBy,
  });
}
