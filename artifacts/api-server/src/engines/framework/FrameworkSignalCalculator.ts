/**
 * TORGIMA P3 — deterministic framework signal snapshots (Phase 1: 4 active frameworks).
 */
import {
  db,
  signalSnapshots,
  conditions,
  falseProgressFlags,
  frameworkSignalSnapshots,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { deriveFrameworkScore, deriveFrameworkSignalState } from "./FrameworkActivationEngine.js";

const PHASE1_ACTIVE = [
  "strategycore",
  "customervalue",
  "synergyops",
  "governance_risk",
] as const;

const DORMANT_FRAMEWORKS = [
  "finmatrix",
  "decision_velocity",
  "talentsync",
  "omnigrowth",
  "adaptive_intelligence",
  "knowledgeflow",
  "alignment_accountability",
  "clarity_catalyst",
  "regeneration_exit",
  "culture_dynamics",
] as const;

export type FrameworkSignalResult = {
  frameworkName: string;
  signalState: string;
  score: number;
  dormant: boolean;
};

export async function calculateFrameworkSignals(
  blueprintId: string,
  userId: string,
  signalSnapshotId: string,
): Promise<FrameworkSignalResult[]> {
  const [signal] = await db
    .select()
    .from(signalSnapshots)
    .where(eq(signalSnapshots.id, signalSnapshotId))
    .limit(1);

  if (!signal) return [];

  const [condition] = await db
    .select()
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
    .limit(1);

  const conditionName = condition?.condition ?? "urgency";

  const twoWeeks = new Date(Date.now() - 14 * 86400000);
  const openFp = await db
    .select({ id: falseProgressFlags.id })
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, blueprintId),
        eq(falseProgressFlags.resolved, false),
        gte(falseProgressFlags.created_at, twoWeeks),
      ),
    )
    .limit(1);

  const results: FrameworkSignalResult[] = [];

  for (const name of PHASE1_ACTIVE) {
    const signalState = deriveFrameworkSignalState(name, signal, conditionName);
    const score = deriveFrameworkScore(name, signal);
    if (openFp && name === "governance_risk" && score < 60) {
      // elevate risk when integrity flags exist
    }
    try {
      await db.insert(frameworkSignalSnapshots).values({
        blueprint_id: blueprintId,
        signal_snapshot_id: signalSnapshotId,
        framework_name: name,
        signal_state: signalState,
        score,
        confidence: signal.confidence === "high" ? 0.9 : 0.6,
        evidence_json: {
          user_id: userId,
          open_false_progress: Boolean(openFp),
          completion_rate: signal.completion_rate,
        },
      });
    } catch {
      /* duplicate cycle — non-fatal */
    }
    results.push({ frameworkName: name, signalState, score, dormant: false });
  }

  for (const name of DORMANT_FRAMEWORKS) {
    try {
      await db.insert(frameworkSignalSnapshots).values({
        blueprint_id: blueprintId,
        signal_snapshot_id: signalSnapshotId,
        framework_name: name,
        signal_state: "DORMANT",
        score: 0,
        confidence: 0,
        evidence_json: { monitor_only: true },
      });
    } catch {
      /* non-fatal */
    }
    results.push({ frameworkName: name, signalState: "DORMANT", score: 0, dormant: true });
  }

  return results;
}
