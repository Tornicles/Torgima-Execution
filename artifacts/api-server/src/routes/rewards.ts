import { Router } from "express";
import { db, rewardEvents } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";

const router = Router();

// GET /api/rewards/history
router.get("/rewards/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const take = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 50);

    const rewards = await db
      .select()
      .from(rewardEvents)
      .where(eq(rewardEvents.user_id, auth.userId))
      .orderBy(desc(rewardEvents.created_at))
      .limit(take);

    success(res, {
      rewards: rewards.map((r) => ({
        id: r.id,
        rewardType: r.reward_type,
        title: r.title,
        description: r.description,
        delivered: r.delivered,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
