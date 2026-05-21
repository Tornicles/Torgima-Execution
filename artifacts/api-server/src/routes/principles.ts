import { Router } from "express";
import { z } from "zod";
import {
  db,
  principleApplications,
  publishedContent,
  userPrincipleProfiles,
  dailyPrincipleRecords,
  userSocialAccounts,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { TorgimaError } from "../lib/errors.js";
import {
  ensurePrinciplesSeeded,
  getAllPrinciples,
  getPrincipleByDay,
  getTodayPrinciple,
  logPrincipleSelection,
  submitPrincipleApplication,
  getStreak,
  freezeStreak,
  getContentGuidanceToday,
  publishContent,
  syncEngagement,
  ensureUserPrincipleProfile,
  getPublicProfile,
  todayDateString,
  PROOF_TYPES,
} from "../engines/principles/Principles365Engine.js";
import { SUPPORTED_PLATFORMS } from "../engines/principles/SocialPublishAdapter.js";

const router = Router();

async function requirePrinciplesEnabled() {
  const on = await checkFeatureFlag(FEATURE_FLAGS.PRINCIPLES_365_ENABLED);
  if (!on) throw new TorgimaError("FEATURE_DISABLED", "365 Principles system is not enabled", false);
}

const submitSchema = z.object({
  principleId: z.string().uuid(),
  proofType: z.enum(PROOF_TYPES),
  proofContent: z.record(z.unknown()).default({}),
  applicationDescription: z.string().min(10).max(8000),
  linkedOrderIds: z.array(z.string().uuid()).optional(),
  publicVisible: z.boolean().optional(),
  fileUrl: z.string().url().optional(),
});

const publishSchema = z.object({
  principleId: z.string().uuid(),
  platforms: z.array(z.enum(SUPPORTED_PLATFORMS)).min(1),
  contentText: z.string().min(1).max(10000),
  publishImmediately: z.boolean().optional(),
});

// ── Stage 1: Principles delivery ─────────────────────────────────────────────

router.get("/principles/today", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.query.blueprintId as string | undefined;
    const payload = await getTodayPrinciple(auth.userId, blueprintId);
    success(res, payload);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principles/all", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    await requireAuth(req, "USER_SESSION");
    await ensurePrinciplesSeeded();
    const all = await getAllPrinciples();
    success(res, { count: all.length, principles: all });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principles/:dayNumber", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    await requireAuth(req, "USER_SESSION");
    const day = Number(req.params.dayNumber);
    if (!Number.isFinite(day) || day < 1 || day > 365) {
      failure(res, "VALIDATION_ERROR", "dayNumber must be 1-365", 400);
      return;
    }
    const principle = await getPrincipleByDay(day);
    if (!principle) {
      failure(res, "NOT_FOUND", "Principle not found", 404);
      return;
    }
    success(res, { principle });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/principles/selection-log", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        principleId: z.string().uuid(),
        selectionReason: z.string().min(1),
        signalState: z.string().optional(),
        executionBlocker: z.string().optional(),
        date: z.string().optional(),
      })
      .parse(req.body);

    const row = await logPrincipleSelection({
      userId: auth.userId,
      principleId: body.principleId,
      selectionReason: body.selectionReason,
      signalState: body.signalState,
      executionBlocker: body.executionBlocker,
      date: body.date,
    });
    success(res, { selection: row }, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// ── Stage 2: Applications & streaks ─────────────────────────────────────────

router.post("/principle-applications/submit", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = submitSchema.parse(req.body);
    const app = await submitPrincipleApplication({
      userId: auth.userId,
      principleId: body.principleId,
      proofType: body.proofType,
      proofContent: body.proofContent,
      applicationDescription: body.applicationDescription,
      linkedOrderIds: body.linkedOrderIds,
      publicVisible: body.publicVisible,
      fileMeta: body.fileUrl ? { fileUrl: body.fileUrl } : undefined,
    });
    const streak = await getStreak(auth.userId);
    success(res, { application: app, streak }, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principle-applications/today", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const dateStr = todayDateString();
    const [app] = await db
      .select()
      .from(principleApplications)
      .where(
        and(
          eq(principleApplications.user_id, auth.userId),
          eq(principleApplications.principle_date, dateStr),
        ),
      )
      .limit(1);
    success(res, { application: app ?? null });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principle-applications/history", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const limit = Math.min(100, Number(req.query.limit ?? 30));
    const rows = await db
      .select()
      .from(principleApplications)
      .where(eq(principleApplications.user_id, auth.userId))
      .orderBy(desc(principleApplications.principle_date))
      .limit(limit);
    success(res, { applications: rows });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principle-applications/:applicationId", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const [app] = await db
      .select()
      .from(principleApplications)
      .where(
        and(
          eq(principleApplications.id, req.params.applicationId),
          eq(principleApplications.user_id, auth.userId),
        ),
      )
      .limit(1);
    if (!app) {
      failure(res, "NOT_FOUND", "Application not found", 404);
      return;
    }
    success(res, { application: app });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/principle-applications/:applicationId/freeze-streak", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const ok = await freezeStreak(auth.userId);
    if (!ok) {
      failure(res, "VALIDATION_ERROR", "Streak already frozen this month", 400);
      return;
    }
    success(res, { frozen: true, streak: await getStreak(auth.userId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principle-streaks/current", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, { streak: await getStreak(auth.userId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// ── Stage 3: Content guidance & publishing ──────────────────────────────────

router.get("/content-guidance/today", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const today = await getTodayPrinciple(auth.userId, req.query.blueprintId as string | undefined);
    const guidance = await getContentGuidanceToday({
      userId: auth.userId,
      principleId: today.principle.id,
      principleStatement: today.principle.statement,
    });
    success(res, { guidance, principle: today.principle });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/published-content/create", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = publishSchema.parse(req.body);
    const result = await publishContent({
      userId: auth.userId,
      principleId: body.principleId,
      platforms: body.platforms,
      contentText: body.contentText,
      publishImmediately: body.publishImmediately,
    });
    success(res, result, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/published-content/history", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const rows = await db
      .select()
      .from(publishedContent)
      .where(eq(publishedContent.user_id, auth.userId))
      .orderBy(desc(publishedContent.published_at))
      .limit(30);
    success(res, { items: rows });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/published-content/:contentId/engagement", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const [row] = await db
      .select()
      .from(publishedContent)
      .where(
        and(
          eq(publishedContent.id, req.params.contentId),
          eq(publishedContent.user_id, auth.userId),
        ),
      )
      .limit(1);
    if (!row) {
      failure(res, "NOT_FOUND", "Content not found", 404);
      return;
    }
    success(res, { engagement: row.engagement, syncedAt: row.synced_engagement_at });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/published-content/sync-engagement", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const count = await syncEngagement(auth.userId);
    success(res, { synced: count });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/social-accounts/connected", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const rows = await db
      .select({
        id: userSocialAccounts.id,
        platform: userSocialAccounts.platform,
        account_id: userSocialAccounts.account_id,
        connected_at: userSocialAccounts.connected_at,
      })
      .from(userSocialAccounts)
      .where(eq(userSocialAccounts.user_id, auth.userId));
    success(res, { accounts: rows });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// ── Stage 4: Public accountability profiles ─────────────────────────────────

router.get("/principle-profiles/:username", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const result = await getPublicProfile(req.params.username);
    if (!result) {
      failure(res, "NOT_FOUND", "Profile not found", 404);
      return;
    }
    if (!result.visible) {
      failure(res, "FORBIDDEN", "Profile is private", 403);
      return;
    }
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principle-profiles/:username/entries", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const result = await getPublicProfile(req.params.username);
    if (!result?.visible) {
      failure(res, "NOT_FOUND", "Profile not found or private", 404);
      return;
    }
    success(res, { entries: result.entries });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principle-profiles/:username/streak", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const result = await getPublicProfile(req.params.username);
    if (!result?.visible) {
      failure(res, "NOT_FOUND", "Profile not found or private", 404);
      return;
    }
    success(res, { streak: result.streak });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principle-profiles/:username/widget", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const result = await getPublicProfile(req.params.username);
    if (!result?.visible) {
      failure(res, "NOT_FOUND", "Profile not private", 404);
      return;
    }
    success(res, {
      username: result.profile.username,
      currentStreak: result.streak.current_streak,
      bestStreak: result.streak.best_streak,
      embedUrl: `/widget/principles/${result.profile.profile_url_slug}`,
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/principle-profiles/settings", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        bio: z.string().max(500).optional(),
        privacySetting: z.enum(["public", "link-only", "private"]).optional(),
        profilePublic: z.boolean().optional(),
        username: z.string().min(3).max(40).optional(),
      })
      .parse(req.body);

    const profile = await ensureUserPrincipleProfile(auth.userId);
    const [updated] = await db
      .update(userPrincipleProfiles)
      .set({
        bio: body.bio ?? profile.bio,
        privacy_setting: body.privacySetting ?? profile.privacy_setting,
        profile_public: body.profilePublic ?? profile.profile_public,
        username: body.username ?? profile.username,
        updated_at: new Date(),
      })
      .where(eq(userPrincipleProfiles.user_id, auth.userId))
      .returning();

    success(res, { profile: updated });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/principles/my-accountability", async (req, res) => {
  try {
    await requirePrinciplesEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const profile = await ensureUserPrincipleProfile(auth.userId);
    const today = await getTodayPrinciple(auth.userId);
    const streak = await getStreak(auth.userId);
    const entries = await db
      .select()
      .from(dailyPrincipleRecords)
      .where(eq(dailyPrincipleRecords.user_id, auth.userId))
      .orderBy(desc(dailyPrincipleRecords.principle_date))
      .limit(30);
    success(res, { profile, today, streak, entries });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
