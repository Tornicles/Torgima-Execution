import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { success } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { checkFeatureFlag } from "../lib/utils.js";
import { TorgimaError } from "../lib/errors.js";
import {
  createPledge,
  ensureShareTokenForDate,
  evaluatePledges,
  getMyProfileSettings,
  getOrCreateWidget,
  getProfileByUsername,
  getProfileEntries,
  getProfileEntryByDate,
  getShareableEntry,
  getShareMetrics,
  getWidgetData,
  listPublicPledges,
  recordEntryReaction,
  recordEntryView,
  recordProfileView,
  updateProfileSettings,
  upsertSocialLink,
} from "../engines/profile/PublicProfileEngine.js";
import { ensureUserPrincipleProfile } from "../engines/principles/Principles365Engine.js";

const router = Router();

async function requirePublicProfilesEnabled() {
  const on = await checkFeatureFlag(FEATURE_FLAGS.PUBLIC_PROFILES_ENABLED);
  if (!on) throw new TorgimaError("FEATURE_DISABLED", "Public profiles are not enabled", false);
}

router.get("/profiles/:username", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const username = z.string().parse(req.params.username);
    const data = await getProfileByUsername(username, { linkOnly: true });
    if (!data) {
      res.status(404).json({ success: false, error: "NOT_FOUND" });
      return;
    }
    if (!data.visible) {
      res.status(404).json({ success: false, error: "PRIVATE" });
      return;
    }
    const auth = await requireAuth(req, "USER_SESSION").catch(() => null);
    await recordProfileView(
      data.profile.user_id,
      auth?.userId ?? null,
      (req.query.ref as string) ?? "direct",
    );
    success(res, data);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/profiles/settings", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const settings = await getMyProfileSettings(auth.userId);
    success(res, settings);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/profiles/:username/entries/:entryDate", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const username = z.string().parse(req.params.username);
    const entryDate = z.string().parse(req.params.entryDate);
    const entry = await getProfileEntryByDate(username, entryDate);
    if (!entry) {
      res.status(404).json({ success: false, error: "NOT_FOUND" });
      return;
    }
    success(res, entry);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/profiles/:username/entries", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const username = z.string().parse(req.params.username);
    const limit = z.coerce.number().int().min(1).max(100).catch(30).parse(req.query.limit);
    const offset = z.coerce.number().int().min(0).catch(0).parse(req.query.offset);
    const entries = await getProfileEntries(username, limit, offset);
    success(res, { entries });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/profiles/settings", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        bio: z.string().max(500).optional(),
        profilePrivacy: z.enum(["public", "link-only", "private"]).optional(),
        username: z.string().min(3).max(40).optional(),
        showExecutionLevel: z.boolean().optional(),
        showAvatar: z.boolean().optional(),
        showAchievements: z.boolean().optional(),
        showPrincipleRecord: z.boolean().optional(),
        showStreak: z.boolean().optional(),
        showActivity: z.boolean().optional(),
      })
      .parse(req.body);
    const profile = await updateProfileSettings(auth.userId, body);
    success(res, { profile });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/profiles/:username/share-token", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const profile = await ensureUserPrincipleProfile(auth.userId);
    const username = z.string().parse(req.params.username);
    if (username !== profile.username && username !== profile.profile_url_slug) {
      res.status(403).json({ success: false, error: "FORBIDDEN" });
      return;
    }
    const date =
      (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
    const entry = await ensureShareTokenForDate(auth.userId, date);
    success(res, { shareToken: entry.share_token, entryDate: entry.entry_date });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/profiles/entries/:shareToken/view", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const shareToken = z.string().parse(req.params.shareToken);
    const entry = await recordEntryView(shareToken);
    if (!entry) {
      res.status(404).json({ success: false, error: "NOT_FOUND" });
      return;
    }
    success(res, { entry });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/profiles/entries/:shareToken", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const shareToken = z.string().parse(req.params.shareToken);
    const data = await getShareableEntry(shareToken);
    if (!data) {
      res.status(404).json({ success: false, error: "NOT_FOUND" });
      return;
    }
    await recordEntryView(shareToken);
    success(res, data);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/profiles/entries/:shareToken/react", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const shareToken = z.string().parse(req.params.shareToken);
    const entry = await recordEntryReaction(shareToken);
    success(res, { entry });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/profiles/:userId/widgets/:widgetType", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const userId = z.string().uuid().parse(req.params.userId);
    const widgetType = z.string().parse(req.params.widgetType);
    const baseUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:5173";
    const widget = await getOrCreateWidget(userId, widgetType, baseUrl);
    const data = await getWidgetData(userId, widgetType);
    success(res, { widget, data });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/profiles/:username/share-metrics", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const metrics = await getShareMetrics(req.params.username);
    success(res, { metrics });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/profiles/:username/pledges", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const username = z.string().parse(req.params.username);
    const data = await getProfileByUsername(username, { linkOnly: true });
    if (!data?.visible) {
      res.status(404).json({ success: false, error: "NOT_FOUND" });
      return;
    }
    const pledges = await listPublicPledges(data.profile.user_id);
    success(res, { pledges });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/profiles/social-links", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z.object({ platform: z.string(), url: z.string().url() }).parse(req.body);
    const link = await upsertSocialLink(auth.userId, body.platform, body.url);
    success(res, { link });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/profiles/pledges/evaluate", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const updated = await evaluatePledges(auth.userId);
    success(res, { updated });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/profiles/pledges", async (req, res) => {
  try {
    await requirePublicProfilesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        pledgeText: z.string().min(1),
        deadline: z.string(),
        isPublic: z.boolean().optional(),
      })
      .parse(req.body);
    const pledge = await createPledge(
      auth.userId,
      body.pledgeText,
      body.deadline,
      body.isPublic,
    );
    success(res, { pledge });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
