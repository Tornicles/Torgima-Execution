/**
 * GAP G4 — every Bhudhi call must include current blueprint state_version.
 */

import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export async function resolveBlueprintStateVersion(
  blueprintId: string,
  userId?: string,
): Promise<number> {
  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(
      userId
        ? and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId))
        : eq(blueprints.id, blueprintId),
    )
    .limit(1);

  return bp?.state_version ?? 0;
}
