/**
 * DOC B4b — Erector Pro paid validation report routes.
 */
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, erectorPaidValidations } from "@workspace/db";
import { requireAuth } from "../../lib/auth.js";
import { success, failure, handleError } from "../../lib/utils.js";
import type { ErectorPaidOutput } from "../../bhudhi/schemas/erector-schemas.js";

const router = Router();

// GET /api/erector/paid/report/:validationId
router.get("/paid/report/:validationId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [row] = await db
      .select()
      .from(erectorPaidValidations)
      .where(
        and(
          eq(erectorPaidValidations.id, req.params.validationId),
          eq(erectorPaidValidations.user_id, auth.userId),
        ),
      )
      .limit(1);

    if (!row) {
      failure(res, "NOT_FOUND", "Validation report not found", 404);
      return;
    }

    success(res, {
      validation_id: row.id,
      tier: row.tier,
      status: row.status,
      report: row.report_json as ErectorPaidOutput,
      blueprint_id: row.blueprint_id,
      blueprint_created: row.blueprint_created,
      completed_at: row.completed_at,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
