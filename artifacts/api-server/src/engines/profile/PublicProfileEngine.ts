/**
 * PROMPT 9 — Public profiles, shareable entries, widgets, pledges.
 */
import crypto from "node:crypto";
import {
  db,
  userPrincipleProfiles,
  dailyPrincipleRecords,
  principles,
  principleApplications,
  users,
  publicProfileViews,
  shareableDailyEntries,
  profileWidgets,
  accountabilityPledges,
  profileSocialLinks,
} from "@workspace/db";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  ensureUserPrincipleProfile,
  getPublicProfile as getPrinciplesPublicProfile,
  getStreak,
} from "../principles/Principles365Engine.js";
import {
  getGamificationProfile,
  listUserAchievements,
} from "../gamification/GamificationEngine.js";

export type ProfilePrivacy = "public" | "link-only" | "private";

export function profileIsVisible(
  profile: typeof userPrincipleProfiles.$inferSelect,
  linkOnlyAccess = false,
): boolean {
  if (profile.privacy_setting === "private" && !profile.profile_public) return false;
  if (profile.privacy_setting === "link-only" && !linkOnlyAccess && !profile.profile_public) {
    return false;
  }
  return profile.profile_public || profile.privacy_setting !== "private";
}

export async function getProfileByUsername(username: string, opts?: { linkOnly?: boolean }) {
  const [bySlug] = await db
    .select({ username: userPrincipleProfiles.username })
    .from(userPrincipleProfiles)
    .where(eq(userPrincipleProfiles.profile_url_slug, username))
    .limit(1);

  const result = await getPrinciplesPublicProfile(bySlug?.username ?? username);
  if (!result?.profile) return null;

  const visible = profileIsVisible(result.profile, opts?.linkOnly);
  if (!visible) return { visible: false as const };

  const gamification = result.profile.show_execution_level
    ? await getGamificationProfile(result.profile.user_id).catch(() => null)
    : null;
  const achievements = result.profile.show_achievements
    ? await listUserAchievements(result.profile.user_id).catch(() => [])
    : [];

  const pledges = await listPublicPledges(result.profile.user_id);
  const socialLinks = await listProfileSocialLinks(result.profile.user_id);
  const shareMetrics = await getShareMetrics(result.profile.profile_url_slug);

  return {
    visible: true as const,
    profile: result.profile,
    streak: result.profile.show_streak ? result.streak : null,
    entries: result.profile.show_principle_record ? result.entries : [],
    gamification,
    achievements,
    pledges,
    socialLinks,
    shareMetrics,
    profileUrl: `/profiles/${result.profile.profile_url_slug}`,
  };
}

export async function getMyProfileSettings(userId: string) {
  const profile = await ensureUserPrincipleProfile(userId);
  const socialLinks = await listProfileSocialLinks(userId);
  const widgets = await db
    .select()
    .from(profileWidgets)
    .where(eq(profileWidgets.user_id, userId));
  return { profile, socialLinks, widgets };
}

export async function getProfileEntryByDate(username: string, entryDate: string) {
  const data = await getProfileByUsername(username, { linkOnly: true });
  if (!data?.visible) return null;

  const entry = (data.entries ?? []).find((e) => e.principle_date === entryDate);
  if (!entry) return null;

  const [principle] = entry.principle_id
    ? await db.select().from(principles).where(eq(principles.id, entry.principle_id)).limit(1)
    : [null];

  const [application] = await db
    .select()
    .from(principleApplications)
    .where(
      and(
        eq(principleApplications.user_id, data.profile.user_id),
        eq(principleApplications.principle_date, entryDate),
      ),
    )
    .limit(1);

  const [share] = await db
    .select()
    .from(shareableDailyEntries)
    .where(
      and(
        eq(shareableDailyEntries.user_id, data.profile.user_id),
        eq(shareableDailyEntries.entry_date, entryDate),
      ),
    )
    .limit(1);

  return { entry, principle, application, shareToken: share?.share_token };
}

export async function updateProfileSettings(
  userId: string,
  input: {
    bio?: string;
    profilePrivacy?: ProfilePrivacy;
    username?: string;
    showExecutionLevel?: boolean;
    showAvatar?: boolean;
    showAchievements?: boolean;
    showPrincipleRecord?: boolean;
    showStreak?: boolean;
    showActivity?: boolean;
  },
) {
  const base = await ensureUserPrincipleProfile(userId);
  const [updated] = await db
    .update(userPrincipleProfiles)
    .set({
      bio: input.bio ?? base.bio,
      username: input.username ?? base.username,
      privacy_setting: input.profilePrivacy ?? base.privacy_setting,
      profile_public: input.profilePrivacy
        ? input.profilePrivacy === "public" || input.profilePrivacy === "link-only"
        : base.profile_public,
      show_execution_level: input.showExecutionLevel ?? base.show_execution_level,
      show_avatar: input.showAvatar ?? base.show_avatar,
      show_achievements: input.showAchievements ?? base.show_achievements,
      show_principle_record: input.showPrincipleRecord ?? base.show_principle_record,
      show_streak: input.showStreak ?? base.show_streak,
      show_activity: input.showActivity ?? base.show_activity,
      updated_at: new Date(),
    })
    .where(eq(userPrincipleProfiles.user_id, userId))
    .returning();
  return updated!;
}

export async function recordProfileView(
  profileUserId: string,
  viewerId: string | null,
  referrer = "direct",
) {
  await db.insert(publicProfileViews).values({
    user_id: profileUserId,
    viewer_id: viewerId,
    referrer_source: referrer,
  });
}

export async function getProfileEntries(username: string, limit = 30, offset = 0) {
  const data = await getProfileByUsername(username, { linkOnly: true });
  if (!data?.visible) return [];
  return (data.entries ?? []).slice(offset, offset + limit);
}

function makeShareToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export async function ensureShareTokenForDate(userId: string, entryDate: string) {
  const [existing] = await db
    .select()
    .from(shareableDailyEntries)
    .where(
      and(eq(shareableDailyEntries.user_id, userId), eq(shareableDailyEntries.entry_date, entryDate)),
    )
    .limit(1);

  if (existing) return existing;

  const [record] = await db
    .select()
    .from(dailyPrincipleRecords)
    .where(
      and(
        eq(dailyPrincipleRecords.user_id, userId),
        eq(dailyPrincipleRecords.principle_date, entryDate),
      ),
    )
    .limit(1);

  const [row] = await db
    .insert(shareableDailyEntries)
    .values({
      user_id: userId,
      entry_date: entryDate,
      principle_id: record?.principle_id,
      daily_record_id: record?.id,
      share_token: makeShareToken(),
      is_public: record?.public_visible ?? true,
    })
    .returning();

  return row!;
}

export async function getShareableEntry(shareToken: string) {
  const [entry] = await db
    .select()
    .from(shareableDailyEntries)
    .where(eq(shareableDailyEntries.share_token, shareToken))
    .limit(1);

  if (!entry || !entry.is_public) return null;

  const [profile] = await db
    .select()
    .from(userPrincipleProfiles)
    .where(eq(userPrincipleProfiles.user_id, entry.user_id))
    .limit(1);

  const [principle] = entry.principle_id
    ? await db.select().from(principles).where(eq(principles.id, entry.principle_id)).limit(1)
    : [null];

  const [application] = await db
    .select()
    .from(principleApplications)
    .where(
      and(
        eq(principleApplications.user_id, entry.user_id),
        eq(principleApplications.principle_date, entry.entry_date),
      ),
    )
    .limit(1);

  return { entry, profile, principle, application };
}

export async function recordEntryView(shareToken: string) {
  const [row] = await db
    .update(shareableDailyEntries)
    .set({
      view_count: sql`${shareableDailyEntries.view_count} + 1`,
      last_viewed_at: new Date(),
    })
    .where(eq(shareableDailyEntries.share_token, shareToken))
    .returning();
  return row ?? null;
}

export async function recordEntryReaction(shareToken: string) {
  const [row] = await db
    .update(shareableDailyEntries)
    .set({
      reaction_count: sql`${shareableDailyEntries.reaction_count} + 1`,
    })
    .where(eq(shareableDailyEntries.share_token, shareToken))
    .returning();
  return row ?? null;
}

export function buildWidgetEmbedCode(userId: string, widgetType: string, baseUrl: string) {
  const widgetUrl = `${baseUrl}/widget/${widgetType}/${userId}`;
  const sizes: Record<string, { w: number; h: number }> = {
    "streak-counter": { w: 200, h: 100 },
    "level-badge": { w: 150, h: 150 },
    "accountability-card": { w: 300, h: 250 },
    "principle-record": { w: 600, h: 400 },
  };
  const size = sizes[widgetType] ?? { w: 200, h: 100 };
  return `<iframe src="${widgetUrl}" width="${size.w}" height="${size.h}" frameborder="0" style="border:none;border-radius:8px;"></iframe>`;
}

export async function getOrCreateWidget(userId: string, widgetType: string, baseUrl: string) {
  const embed = buildWidgetEmbedCode(userId, widgetType, baseUrl);
  const [row] = await db
    .insert(profileWidgets)
    .values({ user_id: userId, widget_type: widgetType, embed_code: embed })
    .onConflictDoUpdate({
      target: [profileWidgets.user_id, profileWidgets.widget_type],
      set: { embed_code: embed },
    })
    .returning();
  return row!;
}

async function resolveProfileByUsernameOrSlug(identifier: string) {
  const [profile] = await db
    .select()
    .from(userPrincipleProfiles)
    .where(
      or(
        eq(userPrincipleProfiles.username, identifier),
        eq(userPrincipleProfiles.profile_url_slug, identifier),
      ),
    )
    .limit(1);
  return profile ?? null;
}

export async function getShareMetrics(usernameOrSlug: string) {
  const profile = await resolveProfileByUsernameOrSlug(usernameOrSlug);
  if (!profile) return null;

  const views = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(publicProfileViews)
    .where(eq(publicProfileViews.user_id, profile.user_id));

  const entries = await db
    .select({
      views: shareableDailyEntries.view_count,
      reactions: shareableDailyEntries.reaction_count,
    })
    .from(shareableDailyEntries)
    .where(eq(shareableDailyEntries.user_id, profile.user_id));

  const totalEntryViews = entries.reduce((s, e) => s + (e.views ?? 0), 0);
  const totalReactions = entries.reduce((s, e) => s + (e.reactions ?? 0), 0);

  return {
    profileViews: views[0]?.count ?? 0,
    entryViews: totalEntryViews,
    reactions: totalReactions,
  };
}

export async function createPledge(
  userId: string,
  pledgeText: string,
  deadline: string,
  isPublic = true,
) {
  const [row] = await db
    .insert(accountabilityPledges)
    .values({
      user_id: userId,
      pledge_text: pledgeText,
      deadline,
      is_public: isPublic,
      status: "active",
    })
    .returning();
  return row!;
}

export async function listProfileSocialLinks(userId: string) {
  return db
    .select()
    .from(profileSocialLinks)
    .where(eq(profileSocialLinks.user_id, userId));
}

export async function listPublicPledges(userId: string) {
  return db
    .select()
    .from(accountabilityPledges)
    .where(
      and(eq(accountabilityPledges.user_id, userId), eq(accountabilityPledges.is_public, true)),
    )
    .orderBy(desc(accountabilityPledges.created_at));
}

export async function upsertSocialLink(userId: string, platform: string, url: string) {
  const [row] = await db
    .insert(profileSocialLinks)
    .values({ user_id: userId, platform, url })
    .onConflictDoUpdate({
      target: [profileSocialLinks.user_id, profileSocialLinks.platform],
      set: { url },
    })
    .returning();
  return row!;
}

export async function evaluatePledges(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const active = await db
    .select()
    .from(accountabilityPledges)
    .where(
      and(eq(accountabilityPledges.user_id, userId), eq(accountabilityPledges.status, "active")),
    );

  const updated: string[] = [];
  for (const pledge of active) {
    if (pledge.deadline >= today) continue;

    const [record] = await db
      .select({ id: dailyPrincipleRecords.id })
      .from(dailyPrincipleRecords)
      .where(
        and(
          eq(dailyPrincipleRecords.user_id, userId),
          eq(dailyPrincipleRecords.principle_date, pledge.deadline),
          eq(dailyPrincipleRecords.public_visible, true),
        ),
      )
      .limit(1);

    const status = record ? "completed" : "missed";
    await db
      .update(accountabilityPledges)
      .set({ status })
      .where(eq(accountabilityPledges.id, pledge.id));
    updated.push(pledge.id);
  }
  return updated;
}

export async function runPledgeEvaluationForActiveUsers() {
  const users = await db
    .selectDistinct({ user_id: accountabilityPledges.user_id })
    .from(accountabilityPledges)
    .where(eq(accountabilityPledges.status, "active"));

  for (const u of users) {
    await evaluatePledges(u.user_id);
  }
}

export async function getWidgetData(userId: string, widgetType: string) {
  const gamification = await getGamificationProfile(userId).catch(() => null);
  const streak = await getStreak(userId);

  switch (widgetType) {
    case "streak-counter":
      return { type: widgetType, currentStreak: streak.current_streak };
    case "level-badge":
      return { type: widgetType, level: gamification?.currentLevel ?? 1 };
    case "accountability-card":
      return {
        type: widgetType,
        level: gamification?.currentLevel ?? 1,
        streak: streak.current_streak,
      };
    default:
      return { type: widgetType, streak: streak.current_streak };
  }
}
