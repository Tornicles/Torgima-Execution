import { Router } from "express";
import { db, capabilityHistory } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";

const router = Router();

// GET /api/capability/history
router.get("/capability/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const history = await db
      .select()
      .from(capabilityHistory)
      .where(eq(capabilityHistory.user_id, auth.userId))
      .orderBy(desc(capabilityHistory.created_at))
      .limit(30);

    success(res, {
      history: history.map((h) => ({
        id: h.id,
        triggerEvent: h.trigger_event,
        snapshot: h.snapshot,
        createdAt: h.created_at,
      })),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
