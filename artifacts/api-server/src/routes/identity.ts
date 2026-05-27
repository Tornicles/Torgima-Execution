import { Router } from "express";
import { db, identityHistory, blueprints } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { getIdentityPanelData } from "../engines/intelligence/IdentityContinuityEngine.js";

const router = Router();

// GET /api/identity/:blueprintId
router.get("/identity/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId!;

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const panel = await getIdentityPanelData(auth.userId, blueprintId);
    const history = await db
      .select()
      .from(identityHistory)
      .where(
        and(
          eq(identityHistory.user_id, auth.userId),
          eq(identityHistory.blueprint_id, blueprintId),
        ),
      )
      .orderBy(desc(identityHistory.created_at))
      .limit(10);

    success(res, {
      identity: panel,
      history: history.map((h) => ({
        id: h.id,
        stageBefore: h.stage_before,
        stageAfter: h.stage_after,
        trigger: h.trigger,
        transformationScore: h.transformation_score,
        createdAt: h.created_at,
      })),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// GET /api/identity/history
router.get("/identity/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const history = await db
      .select()
      .from(identityHistory)
      .where(eq(identityHistory.user_id, auth.userId))
      .orderBy(desc(identityHistory.created_at))
      .limit(20);

    success(res, {
      history: history.map((h) => ({
        id: h.id,
        stageBefore: h.stage_before,
        stageAfter: h.stage_after,
        trigger: h.trigger,
        transformationScore: h.transformation_score,
        createdAt: h.created_at,
      })),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
