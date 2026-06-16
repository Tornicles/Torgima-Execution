import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../../lib/auth.js";
import { handleError, failure } from "../../lib/utils.js";
import {
  erectorSuccess,
  finishErectorApiLog,
  getActiveBlueprintId,
  readIdempotencyKey,
  withApiIdempotency,
} from "../../lib/erectorApiHelpers.js";
import { evidenceLedgerService } from "../../services/erector/evidence/EvidenceLedgerService.js";
import { EVENT_TYPES, writeEvent } from "../../services/EventService.js";

const router = Router();

const submitEvidenceSchema = z.object({
  blueprint_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  academy_task_id: z.string().uuid().optional(),
  outcome_id: z.string().uuid().optional(),
  validation_run_id: z.string().uuid().optional(),
  source_type: z.string().min(1),
  source_location: z.string().optional(),
  content_json: z.record(z.string(), z.unknown()),
  content_summary: z.string().optional(),
});

router.post("/submit", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = submitEvidenceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid evidence submission body", 400);
      return;
    }

    const blueprintId =
      parsed.data.blueprint_id ?? (await getActiveBlueprintId(auth.userId)) ?? undefined;

    const idempotencyKey = readIdempotencyKey(req);
    const outcome = await withApiIdempotency("evidence_submit", idempotencyKey, async () => {
      const result = await evidenceLedgerService.submit({
        userId: auth.userId,
        blueprintId,
        taskId: parsed.data.task_id,
        academyTaskId: parsed.data.academy_task_id,
        outcomeId: parsed.data.outcome_id,
        validationRunId: parsed.data.validation_run_id,
        sourceType: parsed.data.source_type,
        sourceLocation: parsed.data.source_location,
        contentJson: parsed.data.content_json,
        contentSummary: parsed.data.content_summary,
      });

      await writeEvent({
        eventType: EVENT_TYPES.ERECTOR_EVIDENCE_SUBMITTED,
        entityType: "erector_evidence",
        entityId: result.evidence_id,
        userId: auth.userId,
        blueprintId,
        payload: {
          evidence_id: result.evidence_id,
          evidence_class: result.evidence_class,
          evidence_strength: result.evidence_strength,
        },
        idempotencyKey: `erector_evidence_submitted:${result.evidence_id}`,
      });

      return {
        status: 201,
        body: {
          ok: true as const,
          data: result,
          message: "Evidence recorded.",
        },
      };
    });

    res.status(outcome.cached ? 200 : outcome.status).json({
      ...outcome.body,
      erector_state: blueprintId
        ? await import("../../engines/erector/erectorStateMachine.js").then((m) =>
            m.getBlueprintErectorState(blueprintId),
          )
        : "not_started",
    });

    await finishErectorApiLog({
      runType: "erector_api_evidence_submit",
      req,
      userId: auth.userId,
      blueprintId,
      startedAt: started,
      statusCode: outcome.cached ? 200 : outcome.status,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/task/:taskId", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const rows = await evidenceLedgerService.getByTask(req.params.taskId, auth.userId);

    await erectorSuccess(
      res,
      { task_id: req.params.taskId, evidence: rows },
      { message: "Task evidence loaded." },
    );

    await finishErectorApiLog({
      runType: "erector_api_evidence_task",
      req,
      userId: auth.userId,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/:evidenceId", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const row = await evidenceLedgerService.getById(req.params.evidenceId, auth.userId);
    if (!row) {
      failure(res, "NOT_FOUND", "Evidence record not found", 404);
      return;
    }

    await erectorSuccess(res, row, {
      message: "Evidence record loaded.",
      blueprintId: row.blueprint_id,
    });

    await finishErectorApiLog({
      runType: "erector_api_evidence_get",
      req,
      userId: auth.userId,
      blueprintId: row.blueprint_id,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
