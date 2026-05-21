import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { success, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { TorgimaError } from "../lib/errors.js";
import {
  awardXP,
  customizeAvatar,
  getGamificationProfile,
  getLeaderboard,
  getPersonalLeaderboard,
  listAvatarTemplatesForLevel,
  listAvailableRewards,
  listUserRewards,
  listUserAchievements,
  listXpLedger,
} from "../engines/gamification/GamificationEngine.js";

const router = Router();

async function requireGamificationEnabled() {
  const on = await checkFeatureFlag(FEATURE_FLAGS.GAMIFICATION_ENABLED);
  if (!on) throw new TorgimaError("FEATURE_DISABLED", "Gamification is not enabled", false);
}

function assertSelf(authUserId: string, targetUserId: string) {
  if (authUserId !== targetUserId) {
    throw new TorgimaError("FORBIDDEN", "Can only access your own gamification profile", false);
  }
}

router.get("/gamification/profile/:userId", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const profile = await getGamificationProfile(userId);
    success(res, { profile });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/profile", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const profile = await getGamificationProfile(auth.userId);
    success(res, { profile });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/xp-ledger", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(req.query.limit);
    const offset = z.coerce.number().int().min(0).catch(0).parse(req.query.offset);
    const ledger = await listXpLedger(auth.userId, limit, offset);
    success(res, { ledger });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/xp-ledger/:userId", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(req.query.limit);
    const offset = z.coerce.number().int().min(0).catch(0).parse(req.query.offset);
    const ledger = await listXpLedger(userId, limit, offset);
    success(res, { ledger });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/achievements", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const achievements = await listUserAchievements(auth.userId);
    success(res, { achievements });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/achievements/:userId", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const achievements = await listUserAchievements(userId);
    success(res, { achievements });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/streaks/:userId", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const profile = await getGamificationProfile(userId);
    success(res, { streaks: profile.streaks });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/gamification/avatar/customize", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        templateId: z.string().uuid(),
        color: z.string().min(1),
        accessories: z.array(z.string()).optional(),
        pose: z.string().optional(),
      })
      .parse(req.body);
    const avatar = await customizeAvatar(auth.userId, body);
    success(res, { avatar });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/avatar/templates", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const profile = await getGamificationProfile(auth.userId);
    const templates = await listAvatarTemplatesForLevel(profile.currentLevel);
    success(res, { templates });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/rewards/earned", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const earned = await listUserRewards(auth.userId);
    success(res, { rewards: earned });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/rewards/available", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const available = await listAvailableRewards(auth.userId);
    success(res, { rewards: available });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/leaderboard", async (req, res) => {
  try {
    await requireGamificationEnabled();
    await requireAuth(req, "USER_SESSION");
    const type = z.enum(["xp", "level"]).catch("xp").parse(req.query.type);
    const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(req.query.limit);
    const leaderboard = await getLeaderboard(type, limit);
    success(res, { leaderboard });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/gamification/leaderboard/personal", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const stats = await getPersonalLeaderboard(auth.userId);
    success(res, { stats });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/gamification/xp/award", async (req, res) => {
  try {
    await requireGamificationEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        eventType: z.string(),
        sourceId: z.string().optional(),
        eventData: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    const result = await awardXP({ userId: auth.userId, ...body });
    success(res, result, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
