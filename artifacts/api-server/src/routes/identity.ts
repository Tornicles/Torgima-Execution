import { Router } from "express";
import { db, identityHistory } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";

const router = Router();

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
