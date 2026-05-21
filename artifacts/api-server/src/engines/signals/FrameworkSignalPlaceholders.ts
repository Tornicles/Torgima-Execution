/**
 * GAP G8 — Phase 1 framework signal placeholders (4 active frameworks).
 */

import { db, frameworkSignalSnapshots } from "@workspace/db";
import { eq } from "drizzle-orm";

/** DOC_11 / G8 active Phase 1 frameworks (enum values). */
export const PHASE1_ACTIVE_FRAMEWORKS = [
  "strategycore",
  "customervalue",
  "synergyops",
  "governance_risk",
] as const;

export type FrameworkSignalRow = {
  framework_name: string;
  signal_state: string;
  score: number | null;
  confidence: number | null;
};

const PLACEHOLDER_STATE = "insufficient_data";

export async function listFrameworkSignalsForBlueprint(
  blueprintId: string,
): Promise<FrameworkSignalRow[]> {
  const rows = await db
    .select({
      framework_name: frameworkSignalSnapshots.framework_name,
      signal_state: frameworkSignalSnapshots.signal_state,
      score: frameworkSignalSnapshots.score,
      confidence: frameworkSignalSnapshots.confidence,
    })
    .from(frameworkSignalSnapshots)
    .where(eq(frameworkSignalSnapshots.blueprint_id, blueprintId));

  return rows.map((r) => ({
    framework_name: r.framework_name as string,
    signal_state: r.signal_state,
    score: r.score,
    confidence: r.confidence,
  }));
}

/** Ensures condition/framework paths never see an empty framework signal set. */
export async function ensureFrameworkSignalPlaceholders(
  blueprintId: string,
): Promise<FrameworkSignalRow[]> {
  const existing = await listFrameworkSignalsForBlueprint(blueprintId);
  const have = new Set(existing.map((r) => r.framework_name));
  const missing = PHASE1_ACTIVE_FRAMEWORKS.filter((f) => !have.has(f));

  for (const framework of missing) {
    await db
      .insert(frameworkSignalSnapshots)
      .values({
        blueprint_id: blueprintId,
        framework_name: framework,
        signal_state: PLACEHOLDER_STATE,
        score: null,
        confidence: null,
        evidence_json: {
          seeded: true,
          note: "Placeholder — no real external data yet",
        },
      })
      .catch(() => null);
  }

  const merged = await listFrameworkSignalsForBlueprint(blueprintId);
  if (merged.length === 0) {
    return PHASE1_ACTIVE_FRAMEWORKS.map((framework_name) => ({
      framework_name,
      signal_state: PLACEHOLDER_STATE,
      score: null,
      confidence: null,
    }));
  }

  return merged;
}

export function defaultFrameworkSignalsWhenEmpty(): FrameworkSignalRow[] {
  return PHASE1_ACTIVE_FRAMEWORKS.map((framework_name) => ({
    framework_name,
    signal_state: PLACEHOLDER_STATE,
    score: null,
    confidence: null,
  }));
}
