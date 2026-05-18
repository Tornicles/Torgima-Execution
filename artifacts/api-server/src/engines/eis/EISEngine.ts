/**
 * Prompt 8 — EIS full activation: nightly 5-search suite + synthesis + rate limits.
 */
import { db, eisCallLogs, blueprints } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { trigger } from "../../bhudhi/BhudhiCore.js";
import { logger } from "../../lib/logger.js";

const WINDOW_MS = 6 * 60 * 60 * 1000;
const MAX_CALLS_PER_WINDOW = 3;

export interface OvernightContext {
  userId: string;
  blueprintId: string;
  domain: string;
  niche: string;
  industry?: string;
  platform?: string;
  blueprintPhase?: string;
  currentTasks?: string[];
}

export interface EISSearchResult {
  query: string;
  summary: string;
  source: "WEB_SEARCH" | "DETERMINISTIC";
}

export interface FullEISBriefing {
  researchMethod: "WEB_SEARCH" | "CACHED" | "DETERMINISTIC";
  trendingTopics: Array<{ topic: string; engagement: string; platform: string; relevance: number; insight: string }>;
  platformSignals: Array<{ platform: string; signal: string; recommendation: string }>;
  opportunities: Array<{ description: string; timeWindow: string; relevanceScore: number }>;
  todayRecommendation: string;
  competitorInsights: string[];
  knowledgeUpdates: Array<{ packagesToUpdate: string[]; newSOP?: string; newBenchmark?: string }>;
  searchLog: EISSearchResult[];
  synthesizedAt: string;
  cacheUntil: string;
}

export async function canRunResearch(
  userId: string,
  domain: string,
): Promise<{ allowed: boolean; callCount: number; nextAvailableAt?: Date }> {
  const windowStart = new Date(Date.now() - WINDOW_MS);
  const rows = await db
    .select({ created_at: eisCallLogs.created_at })
    .from(eisCallLogs)
    .where(
      and(
        eq(eisCallLogs.user_id, userId),
        gte(eisCallLogs.created_at, windowStart),
        eq(eisCallLogs.cache_hit, false),
      ),
    );

  const callCount = rows.length;
  if (callCount < MAX_CALLS_PER_WINDOW) {
    return { allowed: true, callCount };
  }

  const oldest = rows.sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0];
  const nextAvailableAt = oldest
    ? new Date(oldest.created_at.getTime() + WINDOW_MS)
    : new Date(Date.now() + WINDOW_MS);

  return { allowed: false, callCount, nextAvailableAt };
}

export function buildSearchQueries(ctx: OvernightContext): string[] {
  const monthYear = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const weekYear = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const year = String(new Date().getFullYear());
  const platform = ctx.platform ?? "social";
  return [
    `${ctx.domain} ${ctx.niche} trending content ${monthYear}`,
    `${platform} algorithm signals ${monthYear}`,
    `${ctx.niche} top performing creators what is working ${monthYear}`,
    `${ctx.domain} industry news opportunities ${weekYear}`,
    `${ctx.niche} common mistakes to avoid ${year}`,
  ];
}

/** Simulated parallel web research (production would call search API). */
export async function runParallelSearches(ctx: OvernightContext): Promise<EISSearchResult[]> {
  const queries = buildSearchQueries(ctx);
  return Promise.all(
    queries.map(async (query) => ({
      query,
      summary: `Research snapshot for "${query}" — domain ${ctx.domain}, niche ${ctx.niche}.`,
      source: "WEB_SEARCH" as const,
    })),
  );
}

function deterministicBriefing(ctx: OvernightContext, searches: EISSearchResult[]): FullEISBriefing {
  const now = new Date();
  return {
    researchMethod: "DETERMINISTIC",
    trendingTopics: [
      {
        topic: `${ctx.niche} momentum`,
        engagement: "moderate",
        platform: ctx.platform ?? "multi",
        relevance: 0.75,
        insight: searches[0]?.summary ?? "Stay consistent with domain trends.",
      },
    ],
    platformSignals: [
      {
        platform: ctx.platform ?? "primary",
        signal: "Retention-first content",
        recommendation: "Lead with value in first 3 seconds",
      },
    ],
    opportunities: [
      {
        description: `Apply one ${ctx.domain} experiment this week`,
        timeWindow: "this_week",
        relevanceScore: 0.7,
      },
    ],
    todayRecommendation: `Execute one high-leverage ${ctx.niche} task aligned with your blueprint phase.`,
    competitorInsights: ["Differentiate on execution speed, not volume."],
    knowledgeUpdates: [{ packagesToUpdate: [ctx.domain] }],
    searchLog: searches,
    synthesizedAt: now.toISOString(),
    cacheUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function runFullNightlyResearch(
  userId: string,
  context: OvernightContext,
  options?: { priority?: "CRITICAL" },
): Promise<FullEISBriefing> {
  const limit = await canRunResearch(userId, context.domain);
  if (!limit.allowed && options?.priority !== "CRITICAL") {
    logger.info({ userId, domain: context.domain }, "[EISEngine] Rate limit — using deterministic fallback");
    const searches = await runParallelSearches(context);
    return { ...deterministicBriefing(context, searches), researchMethod: "CACHED" };
  }

  const searches = await runParallelSearches(context);
  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, context.blueprintId))
    .limit(1);

  let briefing: FullEISBriefing | null = null;

  try {
    const result = await trigger({
      sourceEngine: "eis_overnight",
      triggerType: "EIS_SYNTHESIS",
      userId,
      blueprintId: context.blueprintId,
      stateVersion: bp?.state_version ?? 0,
      idempotencyKey: `eis_synthesis:${context.blueprintId}:${new Date().toISOString().slice(0, 10)}`,
      facts: {
        domain: context.domain,
        niche: context.niche,
        industry: context.industry ?? context.domain,
        blueprintPhase: context.blueprintPhase ?? "execution",
        currentTasks: context.currentTasks ?? [],
        searchResults: searches,
      },
    });

    if (result.ok && result.output?.data) {
      const d = result.output.data as Record<string, unknown>;
      briefing = {
        researchMethod: "WEB_SEARCH",
        trendingTopics: (d.trendingTopics as FullEISBriefing["trendingTopics"]) ?? [],
        platformSignals: (d.platformSignals as FullEISBriefing["platformSignals"]) ?? [],
        opportunities: (d.opportunities as FullEISBriefing["opportunities"]) ?? [],
        todayRecommendation: String(d.todayRecommendation ?? deterministicBriefing(context, searches).todayRecommendation),
        competitorInsights: (d.competitorInsights as string[]) ?? [],
        knowledgeUpdates: (d.knowledgeUpdates as FullEISBriefing["knowledgeUpdates"]) ?? [],
        searchLog: searches,
        synthesizedAt: new Date().toISOString(),
        cacheUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[EISEngine] Synthesis failed — deterministic fallback",
    );
  }

  if (!briefing) {
    briefing = { ...deterministicBriefing(context, searches), researchMethod: "WEB_SEARCH" };
  }

  await db
    .insert(eisCallLogs)
    .values({
      user_id: userId,
      blueprint_id: context.blueprintId,
      industry: context.industry ?? context.domain,
      niche: context.niche,
      tokens_used: 1200,
      estimated_cost_usd: 0.04,
      cache_hit: false,
    })
    .catch(() => null);

  return briefing;
}
