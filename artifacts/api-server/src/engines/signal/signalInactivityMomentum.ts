/**
 * Phase 8 — inactivity records reduce consecutive-day momentum.
 */

import { db, inactivityRecords } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const MEDIUM_PLUS = new Set(["medium", "high", "critical"]);

export function isInactivityTriggerReason(reason: string | undefined): boolean {
  if (!reason) return false;
  const r = reason.toLowerCase();
  return r === "inactivity" || r.startsWith("inactivity");
}

export async function applyInactivityMomentumPenalty(params: {
  blueprintId: string;
  momentum: number;
  triggerReason?: string;
}): Promise<number> {
  const records = await db
    .select({ severity: inactivityRecords.severity })
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.blueprint_id, params.blueprintId),
        eq(inactivityRecords.resolved, false),
      ),
    );

  const unresolvedMediumPlus = records.filter((r) =>
    MEDIUM_PLUS.has(String(r.severity ?? "").toLowerCase()),
  );

  if (unresolvedMediumPlus.length === 0) {
    return params.momentum;
  }

  let adjusted = params.momentum;

  if (isInactivityTriggerReason(params.triggerReason)) {
    adjusted = Math.max(0, adjusted - 1);
  }

  const penalty = Math.min(adjusted, unresolvedMediumPlus.length);
  return Math.max(0, adjusted - penalty);
}
