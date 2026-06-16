import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { blueprints, db } from "@workspace/db";
import { requireAuth } from "../../lib/auth.js";
import { handleError, failure } from "../../lib/utils.js";
import { getOpenFlags } from "../../engines/outcome/OutcomeValidationEngine.js";
import {
  erectorSuccess,
  finishErectorApiLog,
  getActiveBlueprintId,
} from "../../lib/erectorApiHelpers.js";

const router = Router();

router.get("/active", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprint_id === "string"
        ? req.query.blueprint_id
        : await getActiveBlueprintId(auth.userId);

    if (!blueprintId) {
      failure(res, "NOT_FOUND", "No active blueprint found", 404);
      return;
    }

    const [owned] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!owned) {
      failure(res, "FORBIDDEN", "You cannot access this blueprint.", 403);
      return;
    }

    const flags = await getOpenFlags(blueprintId);

    await erectorSuccess(
      res,
      {
        blueprint_id: blueprintId,
        flags,
        count: flags.length,
      },
      {
        message: "Open false progress flags loaded.",
        blueprintId,
      },
    );

    await finishErectorApiLog({
      runType: "erector_api_false_progress",
      req,
      userId: auth.userId,
      blueprintId,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
