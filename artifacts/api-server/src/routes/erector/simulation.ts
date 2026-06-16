import { Router } from "express";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, erectorSimulationRuns, erectorValidationRuns } from "@workspace/db";
import { requireAuth } from "../../lib/auth.js";
import { authMiddleware, requireTier } from "../../middleware/auth.js";
import type { AuthContext } from "../../types/auth.js";
import { handleError, failure } from "../../lib/utils.js";
import {
  erectorSuccess,
  finishErectorApiLog,
  readIdempotencyKey,
  withApiIdempotency,
} from "../../lib/erectorApiHelpers.js";
import { assertTierPermission, filterAuditRecordForTier } from "../../services/erector/TierPermissionMatrix.js";
import { getBlueprintErectorState } from "../../engines/erector/erectorStateMachine.js";
import { runSimulationOrchestrator } from "../../engines/erector/simulation/ErectorSimulationOrchestrator.js";
import { EVENT_TYPES, writeEvent } from "../../services/EventService.js";

const router = Router();

const requestSimulationSchema = z.object({
  validation_run_id: z.string().uuid(),
  tier: z.string().optional(),
});

const resimulateSchema = z.object({
  changed_inputs: z.record(z.string(), z.unknown()).optional(),
});

async function loadSimulationRun(simulationId: string, userId: string) {
  const [run] = await db
    .select()
    .from(erectorSimulationRuns)
    .where(
      and(eq(erectorSimulationRuns.id, simulationId), eq(erectorSimulationRuns.user_id, userId)),
    )
    .limit(1);
  return run ?? null;
}

router.post("/request", authMiddleware, requireTier("growth"), async (req, res) => {
  try {
    const started = Date.now();
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const parsed = requestSimulationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid simulation request body", 400);
      return;
    }

    const tier = parsed.data.tier ?? "authenticated";
    const permission = assertTierPermission(tier, "simulation_allowed");
    if (!permission.allowed) {
      failure(res, "ERECTOR_LAUNCH_BLOCKED", permission.reason ?? "Simulation not permitted", 403);
      return;
    }

    const idempotencyKey = readIdempotencyKey(req);
    const outcome = await withApiIdempotency("simulation_request", idempotencyKey, async () => {
      const [validationRun] = await db
        .select()
        .from(erectorValidationRuns)
        .where(
          and(
            eq(erectorValidationRuns.id, parsed.data.validation_run_id),
            eq(erectorValidationRuns.user_id, auth.userId),
          ),
        )
        .limit(1);

      if (!validationRun?.blueprint_id) {
        return { status: 404, body: { ok: false as const, error: "NOT_FOUND" } };
      }

      const erectorState = await getBlueprintErectorState(validationRun.blueprint_id);
      if (erectorState !== "PATH_SELECTED" && erectorState !== "SIMULATION_REQUIRED") {
        return { status: 403, body: { ok: false as const, error: "ERECTOR_STATE_INVALID" } };
      }

      const result = await runSimulationOrchestrator(
        validationRun.id,
        auth.userId,
        validationRun.blueprint_id,
        parsed.data.tier ?? validationRun.tier ?? "growth",
      );

      return {
        status: 201,
        body: {
          ok: true as const,
          data: result,
          erector_state: await getBlueprintErectorState(validationRun.blueprint_id),
          message: "Simulation complete.",
        },
      };
    });

    if (!outcome.body.ok) {
      if (outcome.body.error === "NOT_FOUND") {
        failure(res, "NOT_FOUND", "Validation run not found", 404);
        return;
      }
      failure(res, "ERECTOR_STATE_INVALID", "Simulation is not available in the current project state.", 403);
      return;
    }

    res.status(outcome.cached ? 200 : outcome.status).json(outcome.body);

    await finishErectorApiLog({
      runType: "erector_api_simulation_request",
      req,
      userId: auth.userId,
      blueprintId: null,
      startedAt: started,
      statusCode: outcome.cached ? 200 : outcome.status,
      verdictIssued:
        typeof outcome.body.data === "object" &&
        outcome.body.data &&
        "verdict" in outcome.body.data
          ? String((outcome.body.data as { verdict?: string }).verdict)
          : undefined,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "SIMULATION_NOT_REQUIRED_FOR_STARTER") {
      failure(res, "VALIDATION_ERROR", "Simulation is not required for your tier.", 422);
      return;
    }
    handleError(req, res, err);
  }
});

router.get("/:simulationId", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const run = await loadSimulationRun(req.params.simulationId, auth.userId);
    if (!run) {
      failure(res, "NOT_FOUND", "Simulation run not found", 404);
      return;
    }

    await erectorSuccess(
      res,
      {
        simulation_run_id: run.id,
        validation_run_id: run.validation_run_id,
        blueprint_id: run.blueprint_id,
        verdict: run.verdict,
        probability_proceed: run.probability_proceed,
        scenarios: assertTierPermission(run.tier, "scenario_access").allowed
          ? {
              best_case: run.best_case_description,
              base_case: run.base_case_description,
              downside: run.downside_description,
            }
          : { summary_only: true },
        framework_verdicts: run.framework_verdicts,
        hard_veto_active: run.veto_active,
      },
      {
        message: "Simulation results loaded.",
        blueprintId: run.blueprint_id,
      },
    );

    await finishErectorApiLog({
      runType: "erector_api_simulation_get",
      req,
      userId: auth.userId,
      blueprintId: run.blueprint_id,
      startedAt: started,
      statusCode: 200,
      verdictIssued: run.verdict ?? undefined,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/:simulationId/resimulate", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = resimulateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid resimulation body", 400);
      return;
    }

    const original = await loadSimulationRun(req.params.simulationId, auth.userId);
    if (!original?.validation_run_id || !original.blueprint_id) {
      failure(res, "NOT_FOUND", "Simulation run not found", 404);
      return;
    }

    const resimPermission = assertTierPermission(original.tier, "resimulation_access");
    if (!resimPermission.allowed) {
      failure(res, "ERECTOR_LAUNCH_BLOCKED", resimPermission.reason ?? "Resimulation not permitted", 403);
      return;
    }

    await writeEvent({
      eventType: EVENT_TYPES.ERECTOR_RESIMULATION_TRIGGERED,
      entityType: "erector_simulation_run",
      entityId: original.id,
      userId: auth.userId,
      blueprintId: original.blueprint_id,
      payload: {
        original_simulation_id: original.id,
        changed_inputs: parsed.data.changed_inputs ?? {},
      },
      idempotencyKey: `erector_resimulation_triggered:${original.id}:${Date.now()}`,
    });

    const result = await runSimulationOrchestrator(
      original.validation_run_id,
      auth.userId,
      original.blueprint_id,
      original.tier ?? "growth",
    );

    await erectorSuccess(res, result, {
      status: 201,
      message: "Resimulation complete.",
      blueprintId: original.blueprint_id,
    });

    await finishErectorApiLog({
      runType: "erector_api_resimulate",
      req,
      userId: auth.userId,
      blueprintId: original.blueprint_id,
      startedAt: started,
      statusCode: 201,
      verdictIssued: result.verdict,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
