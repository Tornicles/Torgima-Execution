import { Router } from "express";
import { z } from "zod/v4";
import { and, desc, eq } from "drizzle-orm";
import { blueprints, db, outcomeValidations } from "@workspace/db";
import { requireAuth } from "../../lib/auth.js";
import { handleError, failure } from "../../lib/utils.js";
import {
  erectorSuccess,
  finishErectorApiLog,
  getActiveBlueprintId,
  readIdempotencyKey,
  withApiIdempotency,
} from "../../lib/erectorApiHelpers.js";
import {
  getOpenFlags,
  validateOutcome,
} from "../../engines/outcome/OutcomeValidationEngine.js";
import { evidenceLedgerService } from "../../services/erector/evidence/EvidenceLedgerService.js";

const router = Router();

const validateOutcomeSchema = z.object({
  blueprint_id: z.string().uuid().optional(),
  target_id: z.string().uuid().optional(),
  claim_text: z.string().optional(),
  evidence_text: z.string().optional(),
  source_type: z.string().default("user_submission"),
  source_id: z.string().optional(),
});

const outcomeEvidenceSchema = z.object({
  source_type: z.string().min(1),
  content_json: z.record(z.string(), z.unknown()),
  content_summary: z.string().optional(),
});

async function resolveBlueprint(userId: string, blueprintId?: string) {
  if (blueprintId) {
    const [row] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);
    return row?.id ?? null;
  }
  return getActiveBlueprintId(userId);
}

router.post("/validate", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = validateOutcomeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid outcome validation body", 400);
      return;
    }

    const blueprintId = await resolveBlueprint(auth.userId, parsed.data.blueprint_id);
    if (!blueprintId) {
      failure(res, "NOT_FOUND", "No active blueprint found", 404);
      return;
    }

    const idempotencyKey = readIdempotencyKey(req);
    const outcome = await withApiIdempotency("outcome_validate", idempotencyKey, async () => {
      const result = await validateOutcome({
        userId: auth.userId,
        blueprintId,
        targetId: parsed.data.target_id,
        claimText: parsed.data.claim_text,
        evidenceText: parsed.data.evidence_text,
        sourceType: parsed.data.source_type,
        sourceId: parsed.data.source_id ?? `api:${Date.now()}`,
      });

      const [record] = await db
        .select()
        .from(outcomeValidations)
        .where(
          and(
            eq(outcomeValidations.blueprint_id, blueprintId),
            eq(outcomeValidations.user_id, auth.userId),
          ),
        )
        .orderBy(desc(outcomeValidations.created_at))
        .limit(1);

      return {
        status: 201,
        body: {
          ok: true as const,
          data: {
            outcome_validation_id: record?.id ?? null,
            ...result,
          },
          message: "Outcome validation complete.",
        },
      };
    });

    const payload = outcome.body.data as { status?: string } | undefined;

    await erectorSuccess(res, outcome.body.data, {
      status: outcome.cached ? 200 : outcome.status,
      message: String(outcome.body.message ?? "Outcome validation complete."),
      blueprintId,
    });

    await finishErectorApiLog({
      runType: "erector_api_outcome_validate",
      req,
      userId: auth.userId,
      blueprintId,
      startedAt: started,
      statusCode: outcome.cached ? 200 : outcome.status,
      verdictIssued: payload?.status,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/:outcomeValidationId", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const [row] = await db
      .select()
      .from(outcomeValidations)
      .where(
        and(
          eq(outcomeValidations.id, req.params.outcomeValidationId),
          eq(outcomeValidations.user_id, auth.userId),
        ),
      )
      .limit(1);

    if (!row) {
      failure(res, "NOT_FOUND", "Outcome validation not found", 404);
      return;
    }

    await erectorSuccess(res, row, {
      message: "Outcome validation loaded.",
      blueprintId: row.blueprint_id,
    });

    await finishErectorApiLog({
      runType: "erector_api_outcome_get",
      req,
      userId: auth.userId,
      blueprintId: row.blueprint_id,
      startedAt: started,
      statusCode: 200,
      verdictIssued: row.verdict ?? undefined,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/:outcomeValidationId/evidence", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = outcomeEvidenceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid outcome evidence body", 400);
      return;
    }

    const [validation] = await db
      .select()
      .from(outcomeValidations)
      .where(
        and(
          eq(outcomeValidations.id, req.params.outcomeValidationId),
          eq(outcomeValidations.user_id, auth.userId),
        ),
      )
      .limit(1);

    if (!validation) {
      failure(res, "NOT_FOUND", "Outcome validation not found", 404);
      return;
    }

    const evidence = await evidenceLedgerService.submit({
      userId: auth.userId,
      blueprintId: validation.blueprint_id,
      outcomeId: validation.target_id ?? validation.id,
      sourceType: parsed.data.source_type,
      contentJson: parsed.data.content_json,
      contentSummary: parsed.data.content_summary,
    });

    await erectorSuccess(res, evidence, {
      status: 201,
      message: "Additional outcome evidence recorded.",
      blueprintId: validation.blueprint_id,
    });

    await finishErectorApiLog({
      runType: "erector_api_outcome_evidence",
      req,
      userId: auth.userId,
      blueprintId: validation.blueprint_id,
      startedAt: started,
      statusCode: 201,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
