import { Router } from "express";
import { db, blueprints, conditions, enforcementPackages, signalSnapshots } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import {
  frameworkSignalsRecord,
  getConditionDisplaySpec,
  metricsToFrameworkSignals,
  normalizeFrameworkSignals,
} from "../engines/condition/ConditionDeterminationEngine.js";
import type { SignalMetrics } from "../engines/signal/SignalCalculationEngine.types.js";
import { readPermanentFrameworkSignals } from "../services/PermanentFrameworkSignalService.js";

const router = Router();

async function handleCurrentCondition(
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
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
      success(res, { condition: null, enforcement: null });
      return;
    }

    const [condition] = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, bp.id), eq(conditions.is_current, true)))
      .limit(1);

    const [enforcement] = await db
      .select()
      .from(enforcementPackages)
      .where(and(eq(enforcementPackages.blueprint_id, bp.id), eq(enforcementPackages.is_current, true)))
      .limit(1);

    const [signal] = await db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, bp.id), eq(signalSnapshots.is_current, true)))
      .orderBy(desc(signalSnapshots.created_at))
      .limit(1);

    const conditionKey = condition?.condition ?? "stability";
    const display = getConditionDisplaySpec(conditionKey);

    const metrics: SignalMetrics | null = signal
      ? {
          completion_rate: signal.completion_rate,
          weighted_score: signal.weighted_score,
          momentum: signal.momentum,
          trend: signal.trend ?? "stable",
          confidence: signal.confidence ?? "medium",
          blocker_ratio: signal.blocker_ratio,
          skip_ratio: signal.skip_ratio,
          tasks_in_window: 5,
          raw_score: signal.weighted_score,
          avg_difficulty_felt: null,
        }
      : null;

    const permanent = await readPermanentFrameworkSignals(bp.id);
    const frameworkSignals = permanent
      ? frameworkSignalsRecord(
          normalizeFrameworkSignals({
            Production: permanent.signals.Production.value,
            Operations: permanent.signals.Operations.value,
            Growth: permanent.signals.Growth.value,
            Scale: permanent.signals.Scale.value,
            momentum: permanent.signals.Production.momentum,
          }),
        )
      : metrics
        ? frameworkSignalsRecord(
            metricsToFrameworkSignals(
              metrics,
              signal?.operational_mathematics_json as Parameters<typeof metricsToFrameworkSignals>[1],
            ),
          )
        : null;

    success(res, {
      blueprintId: bp.id,
      display,
      frameworkSignals,
      condition: condition
        ? {
            condition: condition.condition,
            durationDays: condition.duration_days,
            escalationLevel: condition.escalation_level,
            recoveryRequired: condition.recovery_required,
            previousCondition: condition.previous_condition,
            transitionReason: condition.transition_reason,
          }
        : null,
      enforcement: enforcement
        ? {
            id: enforcement.id,
            taskLimits: enforcement.task_limits,
            difficultyCap: enforcement.difficulty_cap,
            allowedActions: enforcement.allowed_actions,
            blockedActions: enforcement.blocked_actions,
            phasePermission: enforcement.phase_permission,
            aiMode: enforcement.ai_mode,
            uiMode: enforcement.ui_mode,
            riskLevel: enforcement.risk_level,
          }
        : null,
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to load condition", 500);
  }
}

router.get("/condition/current", handleCurrentCondition);
router.get("/conditions/current", handleCurrentCondition);

router.get("/condition/history", async (req, res): Promise<void> => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

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
      success(res, { history: [] });
      return;
    }

    const rows = await db
      .select({
        id: conditions.id,
        condition: conditions.condition,
        previousCondition: conditions.previous_condition,
        transitionReason: conditions.transition_reason,
        recoveryRequired: conditions.recovery_required,
        durationDays: conditions.duration_days,
        enteredAt: conditions.entered_at,
        exitedAt: conditions.exited_at,
        isCurrent: conditions.is_current,
      })
      .from(conditions)
      .where(eq(conditions.blueprint_id, bp.id))
      .orderBy(desc(conditions.entered_at))
      .limit(limit);

    success(res, {
      blueprintId: bp.id,
      history: rows.map((r) => ({
        id: r.id,
        condition: r.condition,
        previousCondition: r.previousCondition,
        transitionReason: r.transitionReason,
        recoveryRequired: r.recoveryRequired,
        durationDays: r.durationDays,
        enteredAt: r.enteredAt,
        exitedAt: r.exitedAt,
        isCurrent: r.isCurrent,
        display: getConditionDisplaySpec(r.condition),
      })),
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to load condition history", 500);
  }
});

export default router;
