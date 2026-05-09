import { Router } from "express";
import { db, academyTasks, academyProof } from "@workspace/db";
import { and, desc, eq, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";

const router = Router();

// GET /api/academy
router.get("/academy", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const academyEnabled = await checkFeatureFlag(FEATURE_FLAGS.ACADEMY_ENABLED);
    if (!academyEnabled) {
      failure(res, "FEATURE_DISABLED", "Academy is not enabled", 403);
      return;
    }

    const tasks = await db
      .select()
      .from(academyTasks)
      .where(and(eq(academyTasks.user_id, auth.userId), ne(academyTasks.status, "completed")))
      .orderBy(desc(academyTasks.created_at))
      .limit(10);

    const proofHistory = await db
      .select()
      .from(academyProof)
      .where(eq(academyProof.user_id, auth.userId))
      .orderBy(desc(academyProof.created_at))
      .limit(5);

    success(res, {
      tasks,
      proofHistory,
      count: tasks.length,
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
