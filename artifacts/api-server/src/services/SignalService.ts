import { logger } from "../lib/logger.js";
import { CONDITIONS, type Condition } from "../constants/conditions.js";
import type { SignalState, SignalSnapshot } from "../types/signal.js";
import { generateId, now } from "../lib/utils.js";
import { db, blueprints, signalSnapshots } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

function normalizeCondition(raw: string | null): Condition {
  const set = new Set<string>(Object.values(CONDITIONS));
  if (raw && set.has(raw)) return raw as Condition;
  return CONDITIONS.NOTHINGNESS;
}

/** Map persisted snapshot to the legacy `SignalState` shape used by the dashboard client. */
export function mapSnapshotToSignalState(
  userId: string,
  row: typeof signalSnapshots.$inferSelect | null,
): SignalState {
  if (!row) {
    return {
      userId,
      momentum: 0,
      consistency: 0,
      velocity: 0,
      condition: CONDITIONS.NOTHINGNESS,
      streak: 0,
      computedAt: new Date().toISOString(),
    };
  }

  const condition = normalizeCondition(row.assigned_condition);
  const completionPct = Math.min(100, Math.round(Number(row.completion_rate) * 100));
  const streakPct = Math.min(100, Math.round((Number(row.momentum) / 14) * 100));
  const scorePct = Math.min(100, Math.round(Math.min(10, Number(row.weighted_score)) * 10));
  return {
    userId,
    momentum: streakPct,
    consistency: completionPct,
    velocity: scorePct,
    condition,
    streak: row.momentum,
    computedAt: row.created_at.toISOString(),
  };
}

async function resolveActiveBlueprintId(userId: string): Promise<string | null> {
  const [bp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return bp?.id ?? null;
}

export const SignalService = {
  async getCurrent(userId: string): Promise<SignalState> {
    const blueprintId = await resolveActiveBlueprintId(userId);
    if (!blueprintId) {
      return mapSnapshotToSignalState(userId, null);
    }

    const [row] = await db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
      .limit(1);

    return mapSnapshotToSignalState(userId, row ?? null);
  },

  async recalculate(userId: string): Promise<SignalState> {
    logger.info({ userId }, "SignalService.recalculate");
    return SignalService.getCurrent(userId);
  },

  async getHistory(userId: string): Promise<SignalSnapshot[]> {
    const blueprintId = await resolveActiveBlueprintId(userId);
    if (!blueprintId) return [];

    const rows = await db
      .select()
      .from(signalSnapshots)
      .where(eq(signalSnapshots.blueprint_id, blueprintId))
      .orderBy(desc(signalSnapshots.window_end))
      .limit(30);

    return rows.map((row) => ({
      id: row.id,
      userId,
      momentum: Math.min(100, Math.round((Number(row.momentum) / 14) * 100)),
      consistency: Math.min(100, Math.round(Number(row.completion_rate) * 100)),
      velocity: Math.min(100, Math.round(Math.min(10, Number(row.weighted_score)) * 10)),
      condition: normalizeCondition(row.assigned_condition),
      snapshotDate: row.created_at.toISOString(),
    }));
  },

  /** Local audit trail only — does not persist a duplicate DB row. */
  async takeSnapshot(userId: string): Promise<SignalSnapshot> {
    const state = await SignalService.getCurrent(userId);
    return {
      id: generateId(),
      userId,
      momentum: state.momentum,
      consistency: state.consistency,
      velocity: state.velocity,
      condition: state.condition,
      snapshotDate: now(),
    };
  },
};
