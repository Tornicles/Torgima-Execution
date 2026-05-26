import { Router } from "express";
import { db, blueprints, signalSnapshots, conditions as conditionsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { explainSignal } from "../engines/signal/SignalCalculationEngine.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import { parseMode } from "../engines/blueprint/BlueprintRuleEngine.js";
import { readTeamSignalFromConfig } from "../engines/blueprint/infrastructure/TeamSignalAggregationService.js";
import {
  frameworkSignalsToApiPayload,
  readPermanentFrameworkSignals,
  recalculatePermanentFrameworkSignals,
} from "../services/PermanentFrameworkSignalService.js";
import { getConditionDisplaySpec } from "../engines/condition/ConditionDeterminationEngine.js";

const router = Router();

// GET /api/signals/current — Prompt 7: persisted snapshot + condition from execution chain.
router.get("/signals/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;

    const [bp] = blueprintId
      ? await db
          .select()
          .from(blueprints)
          .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
          .limit(1)
      : await db
          .select()
          .from(blueprints)
          .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
          .limit(1);

    if (!bp) {
      success(res, { signal: null, condition: null });
      return;
    }

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
      success(res, {
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
        mode: bp.mode,
      });
      return;
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
    const conditionKey = condition?.condition ?? assigned;

    success(res, {
      frameworkSignals: frameworkBundle ? frameworkSignalsToApiPayload(frameworkBundle) : null,
      conditionDisplay: getConditionDisplaySpec(conditionKey),
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
      mode: bp.mode,
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to get signal", 500);
  }
});

router.get("/signals/framework", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;
    const recalc = req.query.recalc === "true";

    const [bp] = blueprintId
      ? await db
          .select({ id: blueprints.id })
          .from(blueprints)
          .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
          .limit(1)
      : await db
          .select({ id: blueprints.id })
          .from(blueprints)
          .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
          .limit(1);

    if (!bp) {
      success(res, { frameworkSignals: null });
      return;
    }

    const bundle = recalc
      ? await recalculatePermanentFrameworkSignals({
          blueprintId: bp.id,
          userId: auth.userId,
        })
      : await readPermanentFrameworkSignals(bp.id);

    success(res, {
      blueprintId: bp.id,
      frameworkSignals: bundle ? frameworkSignalsToApiPayload(bundle) : null,
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to load framework signals", 500);
  }
});

router.get("/signals/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;

    const [bp] = blueprintId
      ? await db
          .select({ id: blueprints.id })
          .from(blueprints)
          .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
          .limit(1)
      : await db
          .select({ id: blueprints.id })
          .from(blueprints)
          .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
          .limit(1);

    if (!bp) {
      success(res, { snapshots: [], blueprintId: null });
      return;
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10) || 30, 90);
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

    const [{ total: totalRaw } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(signalSnapshots)
      .where(eq(signalSnapshots.blueprint_id, bp.id));

    const total = totalRaw ?? 0;

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

    const hasMore = offset + snapshots.length < total;

    success(res, { snapshots, total, hasMore, blueprintId: bp.id });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to load signal history", 500);
  }
});

export default router;
