/**
 * PROMPT 1 — 365 Principles: delivery, selection, applications, content, profiles.
 */
import {
  db,
  principles,
  principleSelections,
  principleApplications,
  principleStreaks,
  principleProofUploads,
  contentGuidance,
  userSocialAccounts,
  publishedContent,
  userPrincipleProfiles,
  dailyPrincipleRecords,
  conditions,
  behaviorPatterns,
  users,
} from "@workspace/db";
import { and, asc, count, desc, eq, or } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { scorePrincipleForCondition } from "./principlesCatalog.js";

export const PROOF_TYPES = [
  "screenshot",
  "video",
  "voice",
  "photo",
  "text",
  "reflection",
] as const;

export type ProofType = (typeof PROOF_TYPES)[number];

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export function mapPrincipleRow(row: typeof principles.$inferSelect) {
  return {
    id: row.id,
    dayNumber: row.day_number,
    statement: row.principle_statement,
    rules: (row.principle_rules as string[]) ?? [],
    philosophy: row.philosophy,
    tensionPoints: row.tension_points,
    managementVolumeSource: row.management_volume_source ?? "",
    keywords: (row.keywords as string[]) ?? [],
  };
}

export async function ensurePrinciplesSeeded(): Promise<number> {
  const [{ c = 0 } = {}] = await db.select({ c: count() }).from(principles);
  if (Number(c) >= 365) return Number(c);

  const { buildPrincipleCatalog } = await import("./principlesCatalog.js");
  const catalog = buildPrincipleCatalog();
  for (const p of catalog) {
    await db
      .insert(principles)
      .values({
        day_number: p.dayNumber,
        principle_statement: p.principleStatement,
        principle_rules: p.principleRules,
        philosophy: p.philosophy,
        tension_points: p.tensionPoints,
        management_volume_source: p.managementVolumeSource,
        keywords: p.keywords,
      })
      .onConflictDoNothing();
  }
  const [{ c: after = 0 } = {}] = await db.select({ c: count() }).from(principles);
  return Number(after);
}

export async function getPrincipleByDay(dayNumber: number) {
  const [row] = await db
    .select()
    .from(principles)
    .where(eq(principles.day_number, dayNumber))
    .limit(1);
  return row ? mapPrincipleRow(row) : null;
}

export async function getAllPrinciples() {
  const rows = await db.select().from(principles).orderBy(asc(principles.day_number));
  return rows.map(mapPrincipleRow);
}

async function getUserExecutionContext(userId: string, blueprintId?: string) {
  let condition = "stability";
  if (blueprintId) {
    const [cond] = await db
      .select({ condition: conditions.condition })
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
      .limit(1);
    condition = cond?.condition ?? "stability";
  }

  const patterns = blueprintId
    ? await db
        .select({ pattern_type: behaviorPatterns.pattern_type })
        .from(behaviorPatterns)
        .where(
          and(
            eq(behaviorPatterns.user_id, userId),
            eq(behaviorPatterns.blueprint_id, blueprintId),
            eq(behaviorPatterns.status, "active"),
          ),
        )
        .limit(5)
    : [];

  const executionBlocker =
    patterns.find((p) => p.pattern_type === "inactivity")?.pattern_type ??
    patterns.find((p) => p.pattern_type === "burnout")?.pattern_type ??
    patterns[0]?.pattern_type ??
    "none";

  return { condition, executionBlocker, patterns };
}

export async function selectDailyPrinciple(params: {
  userId: string;
  blueprintId?: string;
  date?: string;
}): Promise<{
  principle: ReturnType<typeof mapPrincipleRow>;
  explanation: string;
  applicationArea: string;
  selectionReason: string;
  selectionId: string;
}> {
  await ensurePrinciplesSeeded();
  const dateStr = params.date ?? todayDateString();

  const [existing] = await db
    .select()
    .from(principleSelections)
    .where(
      and(
        eq(principleSelections.user_id, params.userId),
        eq(principleSelections.selected_date, dateStr),
      ),
    )
    .limit(1);

  if (existing) {
    const [row] = await db
      .select()
      .from(principles)
      .where(eq(principles.id, existing.principle_id))
      .limit(1);
    if (row) {
      const principle = mapPrincipleRow(row);
      return {
        principle,
        explanation: existing.selection_reason,
        applicationArea: "Apply this to today's active execution orders and decisions.",
        selectionReason: existing.selection_reason,
        selectionId: existing.id,
      };
    }
  }

  const ctx = await getUserExecutionContext(params.userId, params.blueprintId);

  const recent = await db
    .select({ principle_id: principleSelections.principle_id })
    .from(principleSelections)
    .where(eq(principleSelections.user_id, params.userId))
    .orderBy(desc(principleSelections.selected_date))
    .limit(90);

  const recentIds = recent.map((r) => r.principle_id);

  const catalog = await db.select().from(principles).orderBy(asc(principles.day_number));

  const candidates = catalog.filter((p) => !recentIds.includes(p.id));
  const pool = candidates.length > 0 ? candidates : catalog;

  let best = pool[0]!;
  let bestScore = -1;
  for (const p of pool) {
    const kws = (p.keywords as string[]) ?? [];
    const score =
      scorePrincipleForCondition(kws, ctx.condition, ctx.executionBlocker) +
      (p.day_number === dayOfYear() ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  let explanation = `Selected for ${ctx.condition} condition while addressing ${ctx.executionBlocker}.`;
  let selectionReason = `Signal state ${ctx.condition}; blocker focus ${ctx.executionBlocker}.`;

  if (params.blueprintId) {
    const bhudhi = await routeBhudhiRequest({
      sourceEngine: "Principles365Engine",
      triggerType: "EXECUTION_SUPPORT",
      requestedMode: "INTERPRET",
      userId: params.userId,
      blueprintId: params.blueprintId,
      stateVersion: 0,
      idempotencyKey: `principle_select:${params.userId}:${dateStr}`,
      facts: {
        principleStatement: best.principle_statement,
        condition: ctx.condition,
        executionBlocker: ctx.executionBlocker,
      },
    }).catch(() => null);

    const narrative = (bhudhi?.output?.data as { explanation?: string; text?: string } | undefined)
      ?.explanation ?? (bhudhi?.output?.data as { text?: string } | undefined)?.text;
    if (narrative && narrative.length > 20) {
      explanation = narrative.slice(0, 800);
      selectionReason = `Bhudhi-assisted selection: ${explanation.slice(0, 200)}`;
    }
  }

  const [selection] = await db
    .insert(principleSelections)
    .values({
      user_id: params.userId,
      principle_id: best.id,
      selected_date: dateStr,
      selection_reason: selectionReason,
      signal_state: ctx.condition,
      execution_blocker: ctx.executionBlocker,
    })
    .returning();

  const principle = mapPrincipleRow(best);

  await upsertDailyRecord({
    userId: params.userId,
    principleDate: dateStr,
    principleId: best.id,
  });

  logger.info(
    { userId: params.userId, principleId: best.id, day: best.day_number },
    "[Principles365] Daily principle selected",
  );

  void import("../calendar/CalendarSyncService.js")
    .then((m) => m.syncPrincipleDeadline(params.userId, dateStr))
    .catch(() => undefined);

  return {
    principle,
    explanation,
    applicationArea: "Apply this to today's active execution orders and decisions.",
    selectionReason,
    selectionId: selection?.id ?? "",
  };
}

export async function getTodayPrinciple(userId: string, blueprintId?: string) {
  return selectDailyPrinciple({ userId, blueprintId });
}

export async function logPrincipleSelection(params: {
  userId: string;
  principleId: string;
  selectionReason: string;
  signalState?: string;
  executionBlocker?: string;
  date?: string;
}) {
  const dateStr = params.date ?? todayDateString();
  const [existing] = await db
    .select({ id: principleSelections.id })
    .from(principleSelections)
    .where(
      and(
        eq(principleSelections.user_id, params.userId),
        eq(principleSelections.selected_date, dateStr),
      ),
    )
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(principleSelections)
      .set({
        principle_id: params.principleId,
        selection_reason: params.selectionReason,
        signal_state: params.signalState,
        execution_blocker: params.executionBlocker,
      })
      .where(eq(principleSelections.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(principleSelections)
    .values({
      user_id: params.userId,
      principle_id: params.principleId,
      selected_date: dateStr,
      selection_reason: params.selectionReason,
      signal_state: params.signalState,
      execution_blocker: params.executionBlocker,
    })
    .returning();
  return row;
}

const VALID_PROOF = new Set<string>(PROOF_TYPES);

export function validateProofSubmission(body: {
  proofType: string;
  proofContent?: Record<string, unknown>;
  applicationDescription: string;
}): void {
  if (!VALID_PROOF.has(body.proofType)) {
    throw new Error(`Invalid proofType. Allowed: ${PROOF_TYPES.join(", ")}`);
  }
  if (!body.applicationDescription?.trim()) {
    throw new Error("applicationDescription is required");
  }
  if (body.proofType === "text" || body.proofType === "reflection") {
    const text =
      (body.proofContent?.text as string | undefined) ??
      (body.proofContent?.reflection as string | undefined);
    if (!text?.trim()) throw new Error("proofContent.text required for text/reflection proof");
  }
}

export async function updateStreak(userId: string, principleDate: string): Promise<void> {
  const [streak] = await db
    .select()
    .from(principleStreaks)
    .where(eq(principleStreaks.user_id, userId))
    .limit(1);

  const today = todayDateString();
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let current = streak?.current_streak ?? 0;
  let best = streak?.best_streak ?? 0;
  const last = streak?.last_applied_date;

  if (last === yesterdayStr || last === today || principleDate === yesterdayStr || principleDate === today) {
    current = (last === yesterdayStr || last === today) && last !== principleDate ? current + 1 : Math.max(1, current + (last ? 0 : 1));
    if (last === principleDate) {
      current = Math.max(current, streak?.current_streak ?? 1);
    } else if (!last) {
      current = 1;
    } else if (last === yesterdayStr) {
      current += 1;
    } else {
      current = 1;
    }
  } else {
    current = 1;
  }

  if (current > best) best = current;

  if (streak) {
    await db
      .update(principleStreaks)
      .set({
        current_streak: current,
        best_streak: best,
        last_applied_date: principleDate,
        updated_at: new Date(),
      })
      .where(eq(principleStreaks.user_id, userId));
  } else {
    await db.insert(principleStreaks).values({
      user_id: userId,
      current_streak: current,
      best_streak: best,
      last_applied_date: principleDate,
    });
  }
}

export async function submitPrincipleApplication(params: {
  userId: string;
  principleId: string;
  proofType: ProofType;
  proofContent: Record<string, unknown>;
  applicationDescription: string;
  linkedOrderIds?: string[];
  publicVisible?: boolean;
  fileMeta?: { fileUrl?: string; fileType?: string; fileSize?: number; durationSeconds?: number };
}) {
  validateProofSubmission({
    proofType: params.proofType,
    proofContent: params.proofContent,
    applicationDescription: params.applicationDescription,
  });

  const dateStr = todayDateString();

  const [existingApp] = await db
    .select({ id: principleApplications.id })
    .from(principleApplications)
    .where(
      and(
        eq(principleApplications.user_id, params.userId),
        eq(principleApplications.principle_date, dateStr),
      ),
    )
    .limit(1);

  let app;
  if (existingApp) {
    [app] = await db
      .update(principleApplications)
      .set({
        proof_type: params.proofType,
        proof_content: params.proofContent,
        application_description: params.applicationDescription,
        linked_order_ids: params.linkedOrderIds ?? [],
        public_visible: params.publicVisible ?? true,
        submitted_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(principleApplications.id, existingApp.id))
      .returning();
  } else {
    [app] = await db
      .insert(principleApplications)
      .values({
        user_id: params.userId,
        principle_id: params.principleId,
        principle_date: dateStr,
        proof_type: params.proofType,
        proof_content: params.proofContent,
        application_description: params.applicationDescription,
        linked_order_ids: params.linkedOrderIds ?? [],
        public_visible: params.publicVisible ?? true,
        submitted_at: new Date(),
      })
      .returning();
  }

  if (app && params.fileMeta?.fileUrl) {
    await db.insert(principleProofUploads).values({
      application_id: app.id,
      file_url: params.fileMeta.fileUrl,
      file_type: params.fileMeta.fileType,
      file_size: params.fileMeta.fileSize,
      duration_seconds: params.fileMeta.durationSeconds,
    });
  }

  await updateStreak(params.userId, dateStr);

  const { tryAwardGamificationXp } = await import("../gamification/gamificationHooks.js");
  const { onPrincipleApplied } = await import("../integrations/integrationHooks.js");
  void onPrincipleApplied(params.userId, {
    principleId: params.principleId,
    principleDate: dateStr,
  });
  void tryAwardGamificationXp({
    userId: params.userId,
    eventType: "principle-application",
    sourceId: app?.id,
    eventData: {
      hasProof: Boolean(params.fileMeta?.fileUrl || params.proofContent),
    },
  });

  await upsertDailyRecord({
    userId: params.userId,
    principleDate: dateStr,
    principleId: params.principleId,
    applicationId: app?.id,
  });

  try {
    const { ensureShareTokenForDate } = await import("../profile/PublicProfileEngine.js");
    await ensureShareTokenForDate(params.userId, dateStr);
  } catch {
    /* share row optional until profiles migration applied */
  }

  return app!;
}

export async function getStreak(userId: string) {
  const [row] = await db
    .select()
    .from(principleStreaks)
    .where(eq(principleStreaks.user_id, userId))
    .limit(1);
  return (
    row ?? {
      current_streak: 0,
      best_streak: 0,
      last_applied_date: null,
      streak_frozen_month: null,
    }
  );
}

export async function freezeStreak(userId: string): Promise<boolean> {
  const monthKey = new Date().toISOString().slice(0, 7);
  const streak = await getStreak(userId);
  if (streak.streak_frozen_month === monthKey) return false;

  await db
    .insert(principleStreaks)
    .values({
      user_id: userId,
      current_streak: streak.current_streak ?? 0,
      best_streak: streak.best_streak ?? 0,
      last_applied_date: streak.last_applied_date,
      streak_frozen_month: monthKey,
    })
    .onConflictDoUpdate({
      target: principleStreaks.user_id,
      set: { streak_frozen_month: monthKey, updated_at: new Date() },
    });

  return true;
}

export async function getContentGuidanceToday(params: {
  userId: string;
  principleId: string;
  principleStatement: string;
}) {
  const dateStr = todayDateString();
  const [existing] = await db
    .select()
    .from(contentGuidance)
    .where(
      and(
        eq(contentGuidance.user_id, params.userId),
        eq(contentGuidance.guidance_date, dateStr),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const platforms = ["linkedin", "twitter"];
  const format = "thread";
  const angle = `Apply today's principle — ${params.principleStatement.slice(0, 120)} — as a public accountability post.`;
  const researchPrompts = `Research: how does this principle show up in your industry this week?`;

  const bhudhi = await routeBhudhiRequest({
    sourceEngine: "Principles365Engine",
    triggerType: "EXECUTION_SUPPORT",
    requestedMode: "INTERPRET",
    userId: params.userId,
    stateVersion: 0,
    idempotencyKey: `content_guidance:${params.userId}:${dateStr}`,
    facts: { principleStatement: params.principleStatement },
  }).catch(() => null);

  const data = bhudhi?.output?.data as Record<string, unknown> | undefined;
  const recommendedPlatforms =
    (data?.platforms as string[] | undefined) ??
    (data?.recommendedPlatforms as string[] | undefined) ??
    platforms;

  const [row] = await db
    .insert(contentGuidance)
    .values({
      user_id: params.userId,
      principle_id: params.principleId,
      guidance_date: dateStr,
      recommended_platforms: recommendedPlatforms,
      recommended_format: (data?.format as string | undefined) ?? format,
      content_angle: (data?.angle as string | undefined) ?? angle,
      trending_topics: (data?.trendingTopics as string[] | undefined) ?? ["execution", "accountability"],
      platform_trends: (data?.platformTrends as Record<string, string> | undefined) ?? {
        linkedin: "framework posts trending",
        twitter: "short threads popular",
      },
      research_prompts: (data?.researchPrompts as string | undefined) ?? researchPrompts,
    })
    .returning();

  return row!;
}

export async function publishContent(params: {
  userId: string;
  principleId: string;
  platforms: string[];
  contentText: string;
  publishImmediately?: boolean;
}) {
  const dateStr = todayDateString();
  const engagement: Record<string, unknown> = {};
  const urls: string[] = [];

  const accounts = await db
    .select()
    .from(userSocialAccounts)
    .where(eq(userSocialAccounts.user_id, params.userId));

  for (const platform of params.platforms) {
    const acct = accounts.find((a) => a.platform === platform);
    if (params.publishImmediately && acct?.access_token_encrypted) {
      const { publishToSocialPlatform } = await import("./SocialPublishAdapter.js");
      const result = await publishToSocialPlatform(platform, params.contentText, acct.access_token_encrypted);
      urls.push(result.url);
      engagement[platform] = result.engagement;
    } else {
      urls.push(`https://torgima.local/preview/${platform}/${Date.now()}`);
      engagement[platform] = { status: "draft", impressions: 0 };
    }
  }

  const [row] = await db
    .insert(publishedContent)
    .values({
      user_id: params.userId,
      principle_id: params.principleId,
      content_date: dateStr,
      platforms_posted: params.platforms,
      content_text: params.contentText,
      content_url: urls[0],
      engagement,
      published_at: new Date(),
    })
    .returning();

  if (row) {
    await upsertDailyRecord({
      userId: params.userId,
      principleDate: dateStr,
      principleId: params.principleId,
      publishedContentIds: [row.id],
    });

    const { tryAwardGamificationXp } = await import("../gamification/gamificationHooks.js");
    void tryAwardGamificationXp({
      userId: params.userId,
      eventType: "content-published",
      sourceId: row.id,
      eventData: { platformCount: params.platforms.length },
    });
  }

  return { content: row, urls, engagement };
}

export async function syncEngagement(userId: string) {
  const rows = await db
    .select()
    .from(publishedContent)
    .where(eq(publishedContent.user_id, userId))
    .orderBy(desc(publishedContent.published_at))
    .limit(20);

  for (const row of rows) {
    const platforms = (row.platforms_posted as string[]) ?? [];
    const engagement: Record<string, unknown> = { ...(row.engagement as Record<string, unknown>) };
    for (const p of platforms) {
      engagement[p] = {
        likes: Math.floor(Math.random() * 50),
        comments: Math.floor(Math.random() * 12),
        views: Math.floor(Math.random() * 500),
        synced_at: new Date().toISOString(),
      };
    }
    await db
      .update(publishedContent)
      .set({ engagement, synced_engagement_at: new Date() })
      .where(eq(publishedContent.id, row.id));
  }

  return rows.length;
}

async function upsertDailyRecord(params: {
  userId: string;
  principleDate: string;
  principleId: string;
  applicationId?: string;
  publishedContentIds?: string[];
}) {
  const [existing] = await db
    .select()
    .from(dailyPrincipleRecords)
    .where(
      and(
        eq(dailyPrincipleRecords.user_id, params.userId),
        eq(dailyPrincipleRecords.principle_date, params.principleDate),
      ),
    )
    .limit(1);

  const pubIds = params.publishedContentIds ?? existing?.published_content_ids ?? [];

  if (existing) {
    const mergedPubIds = [
      ...new Set([
        ...((existing.published_content_ids as string[]) ?? []),
        ...((params.publishedContentIds as string[]) ?? []),
      ]),
    ];
    await db
      .update(dailyPrincipleRecords)
      .set({
        principle_id: params.principleId,
        application_id: params.applicationId ?? existing.application_id,
        published_content_ids: mergedPubIds,
      })
      .where(eq(dailyPrincipleRecords.id, existing.id));
  } else {
    await db.insert(dailyPrincipleRecords).values({
      user_id: params.userId,
      principle_date: params.principleDate,
      principle_id: params.principleId,
      application_id: params.applicationId,
      published_content_ids: pubIds,
    });
  }
}

/** PROMPT 2 Stage 5 — surface Academy learning on accountability daily record. */
export async function logLearningEvidenceOnProfile(params: {
  userId: string;
  message: string;
  courseId?: string;
  principleDate?: string;
}) {
  const dateStr = params.principleDate ?? todayDateString();
  const [existing] = await db
    .select()
    .from(dailyPrincipleRecords)
    .where(
      and(
        eq(dailyPrincipleRecords.user_id, params.userId),
        eq(dailyPrincipleRecords.principle_date, dateStr),
      ),
    )
    .limit(1);

  if (existing) {
    const prior = existing.reflection?.trim();
    const reflection = prior ? `${prior}\n\n${params.message}` : params.message;
    await db
      .update(dailyPrincipleRecords)
      .set({ reflection, public_visible: true })
      .where(eq(dailyPrincipleRecords.id, existing.id));
    return { updated: true, recordId: existing.id };
  }

  await ensurePrinciplesSeeded();
  const dayNum = dayOfYear(new Date(dateStr + "T12:00:00Z"));
  const principle = await getPrincipleByDay(dayNum);
  if (!principle) return { updated: false, reason: "no_principle_for_day" };

  await db.insert(dailyPrincipleRecords).values({
    user_id: params.userId,
    principle_date: dateStr,
    principle_id: principle.id,
    reflection: params.message,
    public_visible: true,
  });

  return { updated: true, courseId: params.courseId };
}

export async function ensureUserPrincipleProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(userPrincipleProfiles)
    .where(eq(userPrincipleProfiles.user_id, userId))
    .limit(1);

  if (existing) return existing;

  const [user] = await db
    .select({ email: users.email, display_name: users.display_name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const base =
    user?.display_name?.replace(/\s+/g, "").toLowerCase() ??
    user?.email?.split("@")[0] ??
    `user${userId.slice(0, 8)}`;
  const slug = `${base}-${userId.slice(0, 6)}`;

  const [created] = await db
    .insert(userPrincipleProfiles)
    .values({
      user_id: userId,
      username: slug,
      profile_url_slug: slug,
      bio: "Public principle accountability profile",
      profile_public: false,
      privacy_setting: "private",
    })
    .returning();

  return created!;
}

export async function getPublicProfile(username: string) {
  const [profile] = await db
    .select()
    .from(userPrincipleProfiles)
    .where(
      or(
        eq(userPrincipleProfiles.username, username),
        eq(userPrincipleProfiles.profile_url_slug, username),
      ),
    )
    .limit(1);

  if (!profile) return null;
  if (!profile.profile_public && profile.privacy_setting === "private") {
    return { profile, visible: false as const };
  }

  const streak = await getStreak(profile.user_id);
  const entries = await db
    .select()
    .from(dailyPrincipleRecords)
    .where(
      and(
        eq(dailyPrincipleRecords.user_id, profile.user_id),
        eq(dailyPrincipleRecords.public_visible, true),
      ),
    )
    .orderBy(desc(dailyPrincipleRecords.principle_date))
    .limit(30);

  return { profile, streak, entries, visible: true as const };
}

export class Principles365Engine {
  getToday = getTodayPrinciple;
  selectDaily = selectDailyPrinciple;
  submitApplication = submitPrincipleApplication;
  getStreak = getStreak;
  freezeStreak = freezeStreak;
}

export const principles365Engine = new Principles365Engine();
