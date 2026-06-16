import { Router } from "express";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, erectorSimulationRuns, erectorValidationRuns } from "@workspace/db";
import { requireAuth } from "../../lib/auth.js";
import { handleError, failure } from "../../lib/utils.js";
import { isTorgimaError } from "../../lib/errors.js";
import {
  checkValidationRateLimit,
  erectorSuccess,
  finishErectorApiLog,
  readIdempotencyKey,
  withApiIdempotency,
} from "../../lib/erectorApiHelpers.js";
import { runValidationOrchestrator } from "../../engines/erector/ErectorValidationOrchestrator.js";
import {
  getBlueprintErectorState,
  updateBlueprintErectorState,
} from "../../engines/erector/erectorStateMachine.js";
import { runSimulationOrchestrator } from "../../engines/erector/simulation/ErectorSimulationOrchestrator.js";
import { getIntakeSessionForUser } from "../../services/erector/intake-service.js";
import { selectValidationPath } from "../../services/erector/ErectorPathSelectionService.js";

const router = Router();

const runValidationSchema = z.object({
  session_id: z.string().uuid(),
  tier: z.string().optional(),
});

const requestValidationSchema = z.object({
  session_id: z.string().uuid().optional(),
  validation_run_id: z.string().uuid().optional(),
  tier: z.string().optional(),
});

const selectPathSchema = z.object({
  selected_path: z.enum(["current", "adjusted", "alternative"]),
});

async function loadValidationRun(validationRunId: string, userId: string) {
  const [run] = await db
    .select()
    .from(erectorValidationRuns)
    .where(
      and(eq(erectorValidationRuns.id, validationRunId), eq(erectorValidationRuns.user_id, userId)),
    )
    .limit(1);
  return run ?? null;
}

async function handleValidationRun(
  req: Parameters<typeof requireAuth>[0],
  res: import("express").Response,
  sessionId: string,
  tier?: string,
  isRevalidation = false,
) {
  const started = Date.now();
  const auth = await requireAuth(req, "USER_SESSION");

  if (!checkValidationRateLimit(auth.userId)) {
    failure(res, "ERECTOR_VALIDATION_RUNNING", "Validation limit reached. Try again in an hour.", 429);
    return;
  }

  const session = await getIntakeSessionForUser(sessionId, auth.userId);
  if (!session) {
    failure(res, "NOT_FOUND", "Intake session not found", 404);
    return;
  }

  const erectorState = session.blueprint_id
    ? await getBlueprintErectorState(session.blueprint_id)
    : "not_started";
  if (erectorState === "VALIDATION_RUNNING" || erectorState === "REVALIDATION_RUNNING") {
    failure(res, "ERECTOR_VALIDATION_RUNNING", "Validation is already running.", 409);
    return;
  }

  await updateBlueprintErectorState(
    session.blueprint_id,
    isRevalidation ? "REVALIDATION_RUNNING" : "VALIDATION_REQUESTED",
  );

  const result = await runValidationOrchestrator(
    sessionId,
    auth.userId,
    tier ?? session.tier,
  );

  await erectorSuccess(res, result, {
    status: 201,
    message: isRevalidation
      ? "Project validation updated with your latest information."
      : "Project validation is running.",
    blueprintId: session.blueprint_id,
  });

  await finishErectorApiLog({
    runType: "erector_api_validation",
    req,
    userId: auth.userId,
    blueprintId: session.blueprint_id,
    startedAt: started,
    statusCode: 201,
    verdictIssued: typeof result.verdict === "string" ? result.verdict : undefined,
  });
}

router.post("/request", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = requestValidationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid validation request body", 400);
      return;
    }

    let sessionId = parsed.data.session_id;
    if (!sessionId && parsed.data.validation_run_id) {
      const run = await loadValidationRun(parsed.data.validation_run_id, auth.userId);
      if (!run?.intake_session_id) {
        failure(res, "NOT_FOUND", "Validation run not found", 404);
        return;
      }
      sessionId = run.intake_session_id;
    }

    if (!sessionId) {
      failure(res, "VALIDATION_ERROR", "session_id or validation_run_id is required", 400);
      return;
    }

    const idempotencyKey = readIdempotencyKey(req);
    const cached = await withApiIdempotency("validation_request", idempotencyKey, async () => {
      const session = await getIntakeSessionForUser(sessionId!, auth.userId);
      if (!session) {
        return { status: 404, body: { ok: false as const, error: "NOT_FOUND" } };
      }
      if (!checkValidationRateLimit(auth.userId)) {
        return { status: 429, body: { ok: false as const, error: "RATE_LIMIT" } };
      }
      await updateBlueprintErectorState(session.blueprint_id, "VALIDATION_REQUESTED");
      const result = await runValidationOrchestrator(sessionId!, auth.userId, parsed.data.tier ?? session.tier);
      return {
        status: 201,
        body: {
          ok: true as const,
          data: result,
          erector_state: session.blueprint_id
            ? await getBlueprintErectorState(session.blueprint_id)
            : "INTAKE_STARTED",
          message: "Project validation is running.",
        },
      };
    });

    if (!cached.body.ok) {
      if (cached.body.error === "NOT_FOUND") {
        failure(res, "NOT_FOUND", "Intake session not found", 404);
        return;
      }
      failure(res, "ERECTOR_VALIDATION_RUNNING", "Validation limit reached. Try again in an hour.", 429);
      return;
    }

    res.status(cached.cached ? 200 : cached.status).json(cached.body);
  } catch (err) {
    if (err instanceof Error && err.message === "INTAKE_NOT_READY") {
      failure(res, "ERECTOR_INTAKE_NOT_READY", "Complete your intake before validation.", 422);
      return;
    }
    handleError(req, res, err);
  }
});

router.post("/run", async (req, res) => {
  try {
    const parsed = runValidationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid validation run body", 400);
      return;
    }
    await handleValidationRun(req, res, parsed.data.session_id, parsed.data.tier, false);
  } catch (err) {
    if (err instanceof Error && err.message === "INTAKE_NOT_READY") {
      failure(res, "ERECTOR_INTAKE_NOT_READY", "Complete your intake before validation.", 422);
      return;
    }
    handleError(req, res, err);
  }
});

router.get("/:validationRunId/paths", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const run = await loadValidationRun(req.params.validationRunId, auth.userId);
    if (!run) {
      failure(res, "NOT_FOUND", "Validation run not found", 404);
      return;
    }

    await erectorSuccess(
      res,
      {
        validation_run_id: run.id,
        paths: {
          current: run.path_current,
          adjusted: run.path_adjusted,
          alternative: run.path_alternative,
        },
        selected_path: run.selected_path,
        verdict: run.verdict,
      },
      {
        message: "Execution paths loaded.",
        blueprintId: run.blueprint_id,
      },
    );

    await finishErectorApiLog({
      runType: "erector_api_validation_paths",
      req,
      userId: auth.userId,
      blueprintId: run.blueprint_id,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/:validationRunId/revalidate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const run = await loadValidationRun(req.params.validationRunId, auth.userId);
    if (!run?.intake_session_id) {
      failure(res, "NOT_FOUND", "Validation run not found", 404);
      return;
    }
    await handleValidationRun(req, res, run.intake_session_id, run.tier ?? undefined, true);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/:validationRunId/select-path", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = selectPathSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid path selection body", 400);
      return;
    }

    const result = await selectValidationPath({
      validationRunId: req.params.validationRunId,
      userId: auth.userId,
      selectedPath: parsed.data.selected_path,
    });

    const run = await loadValidationRun(req.params.validationRunId, auth.userId);

    await erectorSuccess(res, result, {
      message: "Execution path selected.",
      blueprintId: run?.blueprint_id,
    });

    await finishErectorApiLog({
      runType: "erector_api_select_path",
      req,
      userId: auth.userId,
      blueprintId: run?.blueprint_id,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    if (isTorgimaError(err) && err.code === "VALIDATION_ERROR") {
      failure(res, err.code, err.message, 400);
      return;
    }
    handleError(req, res, err);
  }
});

router.get("/:validationRunId", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const run = await loadValidationRun(req.params.validationRunId, auth.userId);
    if (!run) {
      failure(res, "NOT_FOUND", "Validation run not found", 404);
      return;
    }

    const [simulation] = await db
      .select({ id: erectorSimulationRuns.id, verdict: erectorSimulationRuns.verdict })
      .from(erectorSimulationRuns)
      .where(
        and(
          eq(erectorSimulationRuns.validation_run_id, run.id),
          eq(erectorSimulationRuns.user_id, auth.userId),
        ),
      )
      .limit(1);

    await erectorSuccess(
      res,
      {
        ...run,
        simulation_run_id: simulation?.id ?? null,
        simulation_verdict: simulation?.verdict ?? null,
      },
      {
        message: "Validation results loaded.",
        blueprintId: run.blueprint_id,
      },
    );

    await finishErectorApiLog({
      runType: "erector_api_validation_get",
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

export default router;
