import { Router } from "express";
import { z } from "zod/v4";
import { eq, and } from "drizzle-orm";
import { blueprints, db } from "@workspace/db";
import { requireAuth } from "../../lib/auth.js";
import { success, failure, handleError } from "../../lib/utils.js";
import { isTorgimaError } from "../../lib/errors.js";
import {
  checkAndResolveCorrectionPath,
  getActiveCorrectionPaths,
  getCorrectionPathById,
  toCustomerView,
} from "../../engines/erector/CorrectionPathEngine.js";
import {
  evaluatePhaseGate,
  getCurrentPhaseGateStatus,
} from "../../engines/erector/PhaseGateEngine.js";

const correctionsRouter = Router();
const phaseGateRouter = Router();

async function resolveActiveBlueprint(userId: string, blueprintId?: string) {
  if (blueprintId) {
    const [row] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId), eq(blueprints.active, true)))
      .limit(1);
    return row?.id ?? null;
  }

  const [row] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return row?.id ?? null;
}

correctionsRouter.get("/active", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = await resolveActiveBlueprint(
      auth.userId,
      typeof req.query.blueprint_id === "string" ? req.query.blueprint_id : undefined,
    );

    if (!blueprintId) {
      failure(res, "NOT_FOUND", "No active blueprint found", 404);
      return;
    }

    const paths = await getActiveCorrectionPaths(auth.userId, blueprintId);
    success(res, {
      blueprint_id: blueprintId,
      corrections: paths.map(toCustomerView),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

correctionsRouter.get("/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const path = await getCorrectionPathById(req.params.id, auth.userId);
    if (!path) {
      failure(res, "NOT_FOUND", "Correction path not found", 404);
      return;
    }

    success(res, {
      ...toCustomerView(path),
      correction_type: path.correction_type,
      blocked_action: path.blocked_action,
      revalidation_required: path.revalidation_required,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

correctionsRouter.post("/:id/check", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const path = await getCorrectionPathById(req.params.id, auth.userId);
    if (!path) {
      failure(res, "NOT_FOUND", "Correction path not found", 404);
      return;
    }

    const result = await checkAndResolveCorrectionPath(req.params.id, auth.userId);
    success(res, {
      resolved: result.resolved,
      still_needed: result.still_needed,
      next_step: result.next_step ?? null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

phaseGateRouter.get("/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = await resolveActiveBlueprint(
      auth.userId,
      typeof req.query.blueprint_id === "string" ? req.query.blueprint_id : undefined,
    );

    if (!blueprintId) {
      failure(res, "NOT_FOUND", "No active blueprint found", 404);
      return;
    }

    const status = await getCurrentPhaseGateStatus({
      userId: auth.userId,
      blueprintId,
    });

    success(res, {
      blueprint_id: blueprintId,
      phase_readiness_score: status.readiness_score,
      gate_result: status.gate_result,
      phase_name: status.phase_name,
      complete: status.complete,
      still_needed: status.still_needed,
      customer_summary:
        status.readiness_score != null
          ? `Your Phase Readiness Score: ${status.readiness_score}/100`
          : "Phase readiness has not been evaluated yet",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

const evaluateSchema = z.object({
  blueprint_id: z.string().uuid().optional(),
  phase_id: z.string().uuid().optional(),
});

phaseGateRouter.post("/evaluate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = evaluateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid phase gate evaluation body", 400);
      return;
    }

    const blueprintId = await resolveActiveBlueprint(auth.userId, parsed.data.blueprint_id);
    if (!blueprintId) {
      failure(res, "NOT_FOUND", "No active blueprint found", 404);
      return;
    }

    let phaseId = parsed.data.phase_id;
    if (!phaseId) {
      const [blueprint] = await db
        .select({ current_phase_id: blueprints.current_phase_id })
        .from(blueprints)
        .where(eq(blueprints.id, blueprintId))
        .limit(1);
      phaseId = blueprint?.current_phase_id ?? undefined;
    }

    if (!phaseId) {
      failure(res, "VALIDATION_ERROR", "No current phase to evaluate", 400);
      return;
    }

    const result = await evaluatePhaseGate({
      userId: auth.userId,
      blueprintId,
      phaseId,
    });

    success(res, {
      gate_result: result.gate_result,
      readiness_score: result.readiness_score,
      criteria_results: result.criteria_results,
      blocking_reasons: result.blocking_reasons,
      correction_path_id: result.correction_path_id ?? null,
      customer_summary: `Your Phase Readiness Score: ${result.readiness_score}/100`,
    });
  } catch (err) {
    if (isTorgimaError(err)) {
      failure(res, err.code, err.message, err.retryable ? 503 : 400);
      return;
    }
    handleError(req, res, err);
  }
});

export { correctionsRouter, phaseGateRouter };
export default correctionsRouter;
