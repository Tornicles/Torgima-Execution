import { Router } from "express";
import { db, blueprints, conditions, enforcementPackages } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";

const router = Router();

// GET /api/condition/current — current condition + enforcement package
router.get("/condition/current", async (req, res) => {
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

    success(res, {
      blueprintId: bp.id,
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
});

export default router;
