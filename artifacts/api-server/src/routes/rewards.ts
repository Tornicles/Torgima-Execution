import { Router } from "express";
import { db, rewardEvents, blueprints } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { getLatestRewardForBlueprint, getPendingRewards } from "../engines/reward/RewardEngine.js";

const router = Router();

async function assertBlueprintOwner(userId: string, blueprintId: string): Promise<boolean> {
  const [bp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);
  return Boolean(bp);
}

// GET /api/rewards/current/:blueprintId
router.get("/rewards/current/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId!;
    if (!(await assertBlueprintOwner(auth.userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const pending = await getPendingRewards(auth.userId, blueprintId);
    const latest = await getLatestRewardForBlueprint(auth.userId, blueprintId);
    success(res, { pending, latest, momentum: pending.length > 0 ? "active" : "steady" });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// GET /api/rewards/history/:blueprintId
router.get("/rewards/history/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId!;
    if (!(await assertBlueprintOwner(auth.userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const since = new Date(Date.now() - 30 * 86400000);
    const rewards = await db
      .select()
      .from(rewardEvents)
      .where(
        and(
          eq(rewardEvents.user_id, auth.userId),
          eq(rewardEvents.blueprint_id, blueprintId),
          gte(rewardEvents.created_at, since),
        ),
      )
      .orderBy(desc(rewardEvents.created_at))
      .limit(50);

    success(res, {
      rewards: rewards.map((r) => ({
        id: r.id,
        rewardType: r.reward_type,
        intensity: r.intensity,
        message: r.message ?? r.description,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

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
