import { logger } from "../lib/logger.js";
import { CONDITIONS, type Condition } from "../constants/conditions.js";
import type { SignalState, SignalSnapshot } from "../types/signal.js";
import { generateId, now } from "../lib/utils.js";
import {
  db,
  blueprints,
  signalSnapshots,
  conditions as conditionsTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { explainSignal } from "../engines/signal/SignalCalculationEngine.js";
import { parseMode } from "../engines/blueprint/BlueprintRuleEngine.js";
import { readTeamSignalFromConfig } from "../engines/blueprint/infrastructure/TeamSignalAggregationService.js";
import {
  frameworkSignalsToApiPayload,
  readPermanentFrameworkSignals,
  recalculatePermanentFrameworkSignals,
} from "./PermanentFrameworkSignalService.js";
import { getConditionDisplaySpec } from "../engines/condition/ConditionDeterminationEngine.js";

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

async function resolveBlueprint(
  userId: string,
  blueprintId?: string,
): Promise<typeof blueprints.$inferSelect | null> {
  if (blueprintId) {
    const [bp] = await db
      .select()
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);
    return bp ?? null;
  }
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return bp ?? null;
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

  async getApiCurrent(userId: string, blueprintId?: string) {
    const bp = await resolveBlueprint(userId, blueprintId);
    if (!bp) return { blueprint: null, signal: null, condition: null };

    const [signal] = await db
      .select()
      .from(signalSnapshots)
      .where(
        and(eq(signalSnapshots.blueprint_id, bp.id), eq(signalSnapshots.is_current, true)),
      )
      .limit(1);

    const [condition] = await db
      .select()
      .from(conditionsTable)
      .where(
        and(eq(conditionsTable.blueprint_id, bp.id), eq(conditionsTable.is_current, true)),
      )
      .limit(1);

    if (!signal) {
      const frameworkOnly = await readPermanentFrameworkSignals(bp.id);
      return {
        blueprint: bp,
        signal: null,
        frameworkSignals: frameworkOnly ? frameworkSignalsToApiPayload(frameworkOnly) : null,
        conditionDisplay: getConditionDisplaySpec(condition?.condition ?? "nothingness"),
        condition: condition
          ? {
              condition: condition.condition,
              durationDays: condition.duration_days,
              escalationLevel: condition.escalation_level,
              recoveryRequired: condition.recovery_required,
            }
          : null,
        teamSignal: null,
      };
    }

    const metrics = {
      completion_rate: signal.completion_rate,
      weighted_score: signal.weighted_score,
      raw_score: signal.weighted_score,
      momentum: signal.momentum,
      trend: signal.trend,
      confidence: signal.confidence,
      blocker_ratio: signal.blocker_ratio,
      skip_ratio: signal.skip_ratio,
      tasks_in_window: 0,
      avg_difficulty_felt: null as string | null,
    };

    const assigned = signal.assigned_condition ?? "nothingness";
    const teamSignal =
      parseMode(bp.mode) === "team" ? readTeamSignalFromConfig(bp.blueprint_config) : null;
    const frameworkBundle = await readPermanentFrameworkSignals(bp.id);

    return {
      blueprint: bp,
      frameworkSignals: frameworkBundle ? frameworkSignalsToApiPayload(frameworkBundle) : null,
      conditionDisplay: getConditionDisplaySpec(condition?.condition ?? assigned),
      signal: {
        id: signal.id,
        completionRate: signal.completion_rate,
        weightedScore: signal.weighted_score,
        momentum: signal.momentum,
        trend: signal.trend,
        confidence: signal.confidence,
        blockerRatio: signal.blocker_ratio,
        skipRatio: signal.skip_ratio,
        condition: assigned,
        windowStart: signal.window_start,
        windowEnd: signal.window_end,
        explanation: explainSignal(metrics, assigned),
        operationalMathematics: signal.operational_mathematics_json,
      },
      condition: condition
        ? {
            condition: condition.condition,
            durationDays: condition.duration_days,
            escalationLevel: condition.escalation_level,
            recoveryRequired: condition.recovery_required,
          }
        : null,
      teamSignal,
    };
  },

  async getApiFramework(userId: string, blueprintId: string | undefined, recalc: boolean) {
    const bp = await resolveBlueprint(userId, blueprintId);
    if (!bp) return null;
    const bundle = recalc
      ? await recalculatePermanentFrameworkSignals({
          blueprintId: bp.id,
          userId,
        })
      : await readPermanentFrameworkSignals(bp.id);
    return { blueprintId: bp.id, frameworkSignals: bundle ? frameworkSignalsToApiPayload(bundle) : null };
  },

  async getApiHistory(
    userId: string,
    blueprintId: string | undefined,
    limit: number,
    offset: number,
  ) {
    const bp = await resolveBlueprint(userId, blueprintId);
    if (!bp) return null;

    const [{ total: totalRaw } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(signalSnapshots)
      .where(eq(signalSnapshots.blueprint_id, bp.id));

    const snapshots = await db
      .select({
        id: signalSnapshots.id,
        window_start: signalSnapshots.window_start,
        window_end: signalSnapshots.window_end,
        completion_rate: signalSnapshots.completion_rate,
        weighted_score: signalSnapshots.weighted_score,
        momentum: signalSnapshots.momentum,
        trend: signalSnapshots.trend,
        confidence: signalSnapshots.confidence,
        blocker_ratio: signalSnapshots.blocker_ratio,
        skip_ratio: signalSnapshots.skip_ratio,
        assigned_condition: signalSnapshots.assigned_condition,
        is_current: signalSnapshots.is_current,
        created_at: signalSnapshots.created_at,
      })
      .from(signalSnapshots)
      .where(eq(signalSnapshots.blueprint_id, bp.id))
      .orderBy(desc(signalSnapshots.window_end))
      .limit(limit)
      .offset(offset);

    return {
      blueprintId: bp.id,
      snapshots,
      total: totalRaw ?? 0,
      hasMore: offset + snapshots.length < (totalRaw ?? 0),
    };
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
