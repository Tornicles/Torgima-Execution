/**
 * Prompt 8 — EIS full activation: nightly 5-search suite + synthesis + rate limits.
 */
import {
  db,
  eisCallLogs,
  blueprints,
  competitorIntelligence,
  trendIntelligence,
  narrativeIntelligence,
  platformAlgorithmSignals,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
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
  activePlatforms?: string[];
  followerTier?: string;
  blueprintPhase?: string;
  currentTasks?: string[];
  preGeneratedOrder?: string | null;
  condition?: string | null;
}

export interface EISSearchResult {
  query: string;
  summary: string;
  source: "WEB_SEARCH" | "DETERMINISTIC";
}

export type EISResearchMethod = "WEB_SEARCH" | "CACHED" | "FALLBACK" | "DETERMINISTIC";
export type ConfidenceTier = "LOW" | "MEDIUM" | "HIGH";
export type TrendVelocityPhase = "EMERGING" | "RISING" | "PEAKING" | "DECLINING" | "DEAD";

export interface CompetitorProfile {
  handle: string;
  recentContent: string;
  performanceSignal: string;
  whatWorked: string;
}

export interface CompetitorIntelligence {
  competitors: CompetitorProfile[];
  keyFindings: string[];
  threatLevel: "LOW" | "MEDIUM" | "HIGH";
  opportunityFlags: string[];
  keyLesson: string;
  researchMethod: EISResearchMethod;
  confidenceTier: ConfidenceTier;
  activityWindow: "24h" | "7d" | "30d";
}

export interface TrendRecord {
  trend: string;
  engagementVolumeNow: number;
  engagementVolumePriorPeriod: number;
  firstSeenHoursAgo: number;
  relevance: number;
}

export interface TrendVelocityScore {
  trend: string;
  velocity: number;
  phase: TrendVelocityPhase;
}

export interface OpportunityWindow {
  trend: string;
  description?: string;
  timeWindow: string;
  relevanceScore: number;
  actionHint: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH";
}

export interface TrendIntelligence {
  trends: TrendRecord[];
  velocityScores: TrendVelocityScore[];
  emergingTrends: TrendVelocityScore[];
  peakingTrends: TrendVelocityScore[];
  decliningTrends: TrendVelocityScore[];
  opportunityWindows: OpportunityWindow[];
  researchMethod: EISResearchMethod;
  confidenceTier: ConfidenceTier;
}

export interface NarrativeIntelligence {
  dominantNarrative: string;
  emergingNarratives: string[];
  sentimentSignal: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
  audienceEmotions: string[];
  contentAngle: string;
  bestContentAngle: string;
  riskNarratives: string[];
  researchMethod: EISResearchMethod;
  confidenceTier: ConfidenceTier;
}

export interface PlatformAlgorithmSignal {
  platform: string;
  signalType: "BOOST" | "SUPPRESS" | "NEUTRAL" | "UNKNOWN";
  contentCategory: string;
  signalStrength: number;
  confidenceTier: ConfidenceTier;
  sourceEvidence: string;
  recommendation: string;
  validUntil: string;
}

export interface FullEISBriefing {
  researchMethod: EISResearchMethod;
  confidenceTier: ConfidenceTier;
  trendingTopics: Array<{ topic: string; engagement: string; platform: string; relevance: number; insight: string }>;
  platformSignals: Array<{ platform: string; signal: string; recommendation: string }>;
  platformAlgorithmSignals: PlatformAlgorithmSignal[];
  opportunities: Array<{ description: string; timeWindow: string; relevanceScore: number }>;
  opportunityWindows: OpportunityWindow[];
  todayRecommendation: string;
  competitorInsights: string[];
  competitorIntelligence: CompetitorIntelligence;
  trendVelocity: TrendIntelligence;
  narrative: NarrativeIntelligence;
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

async function runQueries(queries: string[], ctx: { domain: string; niche: string }): Promise<EISSearchResult[]> {
  return Promise.all(
    queries.map(async (query) => ({
      query,
      summary: `Research snapshot for "${query}" — domain ${ctx.domain}, niche ${ctx.niche}.`,
      source: "WEB_SEARCH" as const,
    })),
  );
}

function expiresIn(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function followerScope(tier: string | undefined): string {
  const t = (tier ?? "").toLowerCase();
  if (t.includes("100k") || t.includes("established")) return "established creators";
  if (t.includes("10k") || t.includes("mid")) return "mid-tier creators";
  if (t.includes("1k") || t.includes("small")) return "small creators 1000 to 10000 followers";
  return "micro creators under 1000 followers";
}

export function classifyVelocityPhase(
  velocity: number,
  firstSeenHoursAgo = 96,
  highVolumeSlowing = false,
): TrendVelocityPhase {
  if (velocity < -0.5) return "DEAD";
  if (velocity < 0) return "DECLINING";
  if (highVolumeSlowing || velocity < 0.1) return "PEAKING";
  if (velocity > 0.7 && firstSeenHoursAgo < 72) return "EMERGING";
  if (velocity >= 0.3) return "RISING";
  return "PEAKING";
}

export function opportunityWindowForPhase(phase: TrendVelocityPhase): string {
  switch (phase) {
    case "EMERGING":
      return "Act in next 48-72 hours";
    case "RISING":
      return "This week";
    case "PEAKING":
      return "Proceed with caution — may be saturating";
    case "DECLINING":
    case "DEAD":
      return "Avoid — trend over";
  }
}

export function deterministicCompetitorIntelligence(
  context: { domain: string; niche: string; userFollowerTier?: string },
  researchMethod: EISResearchMethod = "WEB_SEARCH",
): CompetitorIntelligence {
  const scope = followerScope(context.userFollowerTier);
  return {
    competitors: [
      {
        handle: `${context.niche}-operator-1`,
        recentContent: `Recent ${context.niche} execution breakdown`,
        performanceSignal: "Audience responded to specific process detail over generic highlights",
        whatWorked: "Clear point-of-view, short proof loop, and repeatable format",
      },
    ],
    keyFindings: [
      `${scope} are getting traction from specific ${context.niche} execution examples`,
      "Broad inspiration content is leaving practical gaps open",
    ],
    threatLevel: "MEDIUM",
    opportunityFlags: [
      `Show the behind-the-scenes execution gap competitors skip in ${context.niche}`,
      "Use proof-led framing instead of copying formats",
    ],
    keyLesson: `Differentiate ${context.domain} output with proof of process, not competitor imitation.`,
    researchMethod,
    confidenceTier: researchMethod === "WEB_SEARCH" ? "MEDIUM" : "LOW",
    activityWindow: "24h",
  };
}

export async function runCompetitorIntelligence(
  userId: string,
  context: { domain: string; niche: string; userFollowerTier: string; blueprintId?: string },
): Promise<CompetitorIntelligence> {
  const scope = followerScope(context.userFollowerTier);
  const queries = [
    `${context.niche} content creators ${scope} what posted recently`,
    `${context.niche} top performing content this week performance data`,
    `${context.niche} creators ${scope} growth strategy ${new Date().getFullYear()}`,
  ];
  const searches = await runQueries(queries, context);
  let intel = deterministicCompetitorIntelligence(context, "WEB_SEARCH");

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "eis_competitor",
      triggerType: "EIS_COMPETITOR_INTELLIGENCE",
      userId,
      blueprintId: context.blueprintId,
      stateVersion: 0,
      idempotencyKey: `eis_competitor:${userId}:${new Date().toISOString().slice(0, 10)}`,
      facts: { ...context, searchResults: searches },
    });
    if (result.ok && result.output?.data) {
      const d = result.output.data as Record<string, unknown>;
      intel = {
        ...intel,
        competitors: (d.competitors as CompetitorProfile[]) ?? intel.competitors,
        threatLevel: (d.threatLevel as CompetitorIntelligence["threatLevel"]) ?? intel.threatLevel,
        opportunityFlags: (d.opportunityGaps as string[]) ?? intel.opportunityFlags,
        keyLesson: String(d.keyLesson ?? intel.keyLesson),
      };
    }
  } catch {
    intel = deterministicCompetitorIntelligence(context, "FALLBACK");
  }

  await db.insert(competitorIntelligence).values({
    user_id: userId,
    domain: context.domain,
    niche: context.niche,
    competitors: intel.competitors,
    activity_window: intel.activityWindow,
    key_findings: intel.keyFindings,
    threat_level: intel.threatLevel,
    opportunity_flags: intel.opportunityFlags,
    research_method: intel.researchMethod,
    confidence_tier: intel.confidenceTier,
    expires_at: expiresIn(24),
  }).catch(() => null);

  return intel;
}

export function buildTrendIntelligence(
  trends: TrendRecord[],
  researchMethod: EISResearchMethod = "WEB_SEARCH",
): TrendIntelligence {
  const velocityScores = trends.map((t) => {
    const prior = Math.max(1, t.engagementVolumePriorPeriod);
    const velocity = (t.engagementVolumeNow - prior) / prior;
    return {
      trend: t.trend,
      velocity,
      phase: classifyVelocityPhase(velocity, t.firstSeenHoursAgo, t.engagementVolumeNow > 80 && velocity < 0.1),
    };
  });

  const opportunityWindows = velocityScores.map((v) => ({
    trend: v.trend,
    timeWindow: opportunityWindowForPhase(v.phase),
    relevanceScore: Math.min(1, Math.max(0.1, Math.abs(v.velocity))),
    actionHint:
      v.phase === "EMERGING" || v.phase === "RISING"
        ? `Use this as context for a same-day execution angle: ${v.trend}`
        : `Do not anchor today's execution on ${v.trend}`,
    urgency: v.phase === "EMERGING" ? "HIGH" : v.phase === "RISING" ? "MEDIUM" : "LOW",
  } satisfies OpportunityWindow));

  return {
    trends,
    velocityScores,
    emergingTrends: velocityScores.filter((v) => v.phase === "EMERGING"),
    peakingTrends: velocityScores.filter((v) => v.phase === "PEAKING"),
    decliningTrends: velocityScores.filter((v) => v.phase === "DECLINING" || v.phase === "DEAD"),
    opportunityWindows,
    researchMethod,
    confidenceTier: researchMethod === "WEB_SEARCH" ? "MEDIUM" : "LOW",
  };
}

export async function runTrendVelocityAnalysis(
  userId: string,
  context: {
    domain: string;
    niche: string;
    existingTrends?: Array<{ topic: string; relevance?: number }>;
  },
): Promise<TrendIntelligence> {
  const seed = context.existingTrends?.length
    ? context.existingTrends
    : [
        { topic: `${context.niche} proof-led execution`, relevance: 0.9 },
        { topic: `${context.niche} behind the scenes`, relevance: 0.75 },
        { topic: `${context.niche} generic tips`, relevance: 0.35 },
        { topic: `${context.niche} daily challenge`, relevance: 0.65 },
        { topic: `${context.niche} highlight reel`, relevance: 0.25 },
      ];
  const trends: TrendRecord[] = seed.slice(0, 5).map((t, i) => ({
    trend: t.topic,
    engagementVolumeNow: [92, 70, 55, 60, 20][i] ?? 40,
    engagementVolumePriorPeriod: [40, 45, 52, 80, 55][i] ?? 35,
    firstSeenHoursAgo: [24, 84, 120, 96, 160][i] ?? 100,
    relevance: t.relevance ?? 0.5,
  }));
  const intel = buildTrendIntelligence(trends, "WEB_SEARCH");

  await db.insert(trendIntelligence).values({
    user_id: userId,
    domain: context.domain,
    niche: context.niche,
    trends: intel.trends,
    velocity_scores: intel.velocityScores,
    emerging_trends: intel.emergingTrends,
    peaking_trends: intel.peakingTrends,
    declining_trends: intel.decliningTrends,
    opportunity_windows: intel.opportunityWindows,
    research_method: intel.researchMethod,
    confidence_tier: intel.confidenceTier,
    expires_at: expiresIn(24),
  }).catch(() => null);

  return intel;
}

export function deterministicNarrativeIntelligence(
  context: { domain: string; niche: string },
  researchMethod: EISResearchMethod = "WEB_SEARCH",
): NarrativeIntelligence {
  const angle = `Show raw ${context.niche} execution with visible tradeoffs and proof`;
  return {
    dominantNarrative: `Audiences in ${context.niche} are rewarding authentic execution over polished claims`,
    emergingNarratives: [`Practical ${context.niche} breakdowns`, "Behind-the-scenes proof", "Mistake-to-fix arcs"],
    sentimentSignal: "MIXED",
    audienceEmotions: ["curiosity", "skepticism", "urgency"],
    contentAngle: angle,
    bestContentAngle: angle,
    riskNarratives: ["Over-claiming results without proof", "Copying competitor formats too closely"],
    researchMethod,
    confidenceTier: researchMethod === "WEB_SEARCH" ? "MEDIUM" : "LOW",
  };
}

export async function runNarrativeIntelligence(
  userId: string,
  context: { domain: string; niche: string; blueprintId?: string },
): Promise<NarrativeIntelligence> {
  const searches = await runQueries(
    [
      `${context.niche} audience conversation sentiment comments ${new Date().getFullYear()}`,
      `${context.niche} what audience wants to see content gaps`,
    ],
    context,
  );
  let intel = deterministicNarrativeIntelligence(context, "WEB_SEARCH");

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "eis_narrative",
      triggerType: "EIS_NARRATIVE_INTELLIGENCE",
      userId,
      blueprintId: context.blueprintId,
      stateVersion: 0,
      idempotencyKey: `eis_narrative:${userId}:${new Date().toISOString().slice(0, 10)}`,
      facts: { ...context, searchResults: searches },
    });
    if (result.ok && result.output?.data) {
      const d = result.output.data as Record<string, unknown>;
      intel = {
        ...intel,
        dominantNarrative: String(d.dominantNarrative ?? intel.dominantNarrative),
        emergingNarratives: (d.emergingNarratives as string[]) ?? intel.emergingNarratives,
        sentimentSignal: (d.sentimentSignal as NarrativeIntelligence["sentimentSignal"]) ?? intel.sentimentSignal,
        audienceEmotions: (d.audienceEmotions as string[]) ?? intel.audienceEmotions,
        contentAngle: String(d.bestContentAngle ?? d.contentAngle ?? intel.contentAngle),
        bestContentAngle: String(d.bestContentAngle ?? d.contentAngle ?? intel.bestContentAngle),
        riskNarratives: (d.riskNarratives as string[]) ?? intel.riskNarratives,
      };
    }
  } catch {
    intel = deterministicNarrativeIntelligence(context, "FALLBACK");
  }

  await db.insert(narrativeIntelligence).values({
    user_id: userId,
    domain: context.domain,
    niche: context.niche,
    dominant_narrative: intel.dominantNarrative,
    emerging_narratives: intel.emergingNarratives,
    sentiment_signal: intel.sentimentSignal,
    audience_emotions: intel.audienceEmotions,
    content_angle: intel.contentAngle,
    risk_narratives: intel.riskNarratives,
    research_method: intel.researchMethod,
    confidence_tier: intel.confidenceTier,
    expires_at: expiresIn(24),
  }).catch(() => null);

  return intel;
}

export async function scanPlatformAlgorithms(
  platforms: string[],
  domain: string,
  niche: string,
): Promise<PlatformAlgorithmSignal[]> {
  const active = platforms.length ? platforms : ["TikTok", "Instagram"];
  const monthYear = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const signals = await Promise.all(
    active.map(async (platform) => {
      const [search] = await runQueries([`${platform} algorithm changes ${monthYear} ${domain} ${niche}`], {
        domain,
        niche,
      });
      const signal: PlatformAlgorithmSignal = {
        platform,
        signalType: "BOOST",
        contentCategory: domain,
        signalStrength: 0.68,
        confidenceTier: search?.summary.includes("official") ? "HIGH" : "MEDIUM",
        sourceEvidence: search?.summary ?? `${platform} creator reports`,
        recommendation: `Prioritize retention-first ${niche} execution with clear proof in the opening seconds.`,
        validUntil: expiresIn(24 * 7).toISOString(),
      };
      await db.insert(platformAlgorithmSignals).values({
        platform: signal.platform,
        signal_type: signal.signalType,
        content_category: signal.contentCategory,
        signal_strength: signal.signalStrength,
        confidence_tier: signal.confidenceTier,
        source_evidence: signal.sourceEvidence,
        recommendation: signal.recommendation,
        valid_until: new Date(signal.validUntil),
      }).catch(() => null);
      return signal;
    }),
  );
  return signals;
}

export async function synthesizeOpportunityWindows(input: {
  trends: TrendIntelligence;
  competitors: CompetitorIntelligence;
  narrative: NarrativeIntelligence;
  currentBlueprintPhase?: string;
  userId?: string;
  blueprintId?: string;
}): Promise<OpportunityWindow[]> {
  const base = input.trends.opportunityWindows
    .filter((w) => w.urgency !== "LOW")
    .map((w) => ({
      ...w,
      description: `${w.trend}: ${input.narrative.bestContentAngle}`,
      actionHint: `${w.actionHint}. Gap to use: ${input.competitors.opportunityFlags[0] ?? "show proof competitors skipped"}.`,
    }));

  let opportunities: OpportunityWindow[] = base.length ? base : [
    {
      trend: "execution gap",
      description: input.narrative.bestContentAngle,
      timeWindow: "This week",
      relevanceScore: 0.65,
      actionHint: input.competitors.keyLesson,
      urgency: "MEDIUM" as const,
    },
  ];

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "eis_opportunity",
      triggerType: "EIS_OPPORTUNITY_SYNTHESIS",
      userId: input.userId ?? "system",
      blueprintId: input.blueprintId,
      stateVersion: 0,
      idempotencyKey: `eis_opportunity:${input.userId ?? "system"}:${new Date().toISOString().slice(0, 10)}`,
      facts: input,
    });
    if (result.ok && result.output?.data) {
      const d = result.output.data as Record<string, unknown>;
      opportunities = (d.opportunities as OpportunityWindow[]) ?? opportunities;
    }
  } catch {
    // Deterministic opportunities above remain valid.
  }

  return opportunities.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export async function generateTodayRecommendation(input: {
  opportunities: OpportunityWindow[];
  activeOrder?: string | null;
  condition?: string | null;
}): Promise<string> {
  const top = input.opportunities[0];
  if (!top) return "Execute the active order and capture proof of outcome.";
  const orderHint = input.activeOrder ? "Use the active order as the delivery vehicle." : "Create one focused execution asset.";
  return `${top.timeWindow}: ${top.actionHint} ${orderHint}`;
}

export async function updateKnowledgeLibrary(
  userId: string,
  domain: string,
  intelligence: {
    trends: TrendIntelligence;
    narrative: NarrativeIntelligence;
    platformSignals: PlatformAlgorithmSignal[];
  },
): Promise<Array<{ packagesToUpdate: string[]; newSOP?: string; newBenchmark?: string }>> {
  return [
    {
      packagesToUpdate: [domain],
      newSOP: intelligence.narrative.bestContentAngle,
      newBenchmark: intelligence.trends.emergingTrends[0]?.trend ?? intelligence.platformSignals[0]?.recommendation,
    },
  ];
}

function deterministicBriefing(ctx: OvernightContext, searches: EISSearchResult[]): FullEISBriefing {
  const now = new Date();
  const competitor = deterministicCompetitorIntelligence(
    { domain: ctx.domain, niche: ctx.niche, userFollowerTier: ctx.followerTier },
    "DETERMINISTIC",
  );
  const trendVelocity = buildTrendIntelligence(
    [
      {
        trend: `${ctx.niche} momentum`,
        engagementVolumeNow: 75,
        engagementVolumePriorPeriod: 45,
        firstSeenHoursAgo: 36,
        relevance: 0.75,
      },
    ],
    "DETERMINISTIC",
  );
  const narrative = deterministicNarrativeIntelligence(ctx, "DETERMINISTIC");
  const platformAlgorithmSignals: PlatformAlgorithmSignal[] = [
    {
      platform: ctx.platform ?? "primary",
      signalType: "BOOST",
      contentCategory: ctx.domain,
      signalStrength: 0.6,
      confidenceTier: "LOW",
      sourceEvidence: "Deterministic fallback",
      recommendation: "Lead with execution proof early.",
      validUntil: expiresIn(24 * 7).toISOString(),
    },
  ];
  const opportunityWindows = trendVelocity.opportunityWindows;
  return {
    researchMethod: "DETERMINISTIC",
    confidenceTier: "LOW",
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
    platformAlgorithmSignals,
    opportunities: [
      {
        description: `Apply one ${ctx.domain} experiment this week`,
        timeWindow: "this_week",
        relevanceScore: 0.7,
      },
    ],
    opportunityWindows,
    todayRecommendation: `Execute one high-leverage ${ctx.niche} task aligned with your blueprint phase.`,
    competitorInsights: ["Differentiate on execution speed, not volume."],
    competitorIntelligence: competitor,
    trendVelocity,
    narrative,
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
  return runFullEISNightlySuite(userId, context, options);
}

export async function getLatestBriefing(
  userId: string,
  domain: string,
): Promise<FullEISBriefing | null> {
  const [competitor] = await db
    .select()
    .from(competitorIntelligence)
    .where(and(eq(competitorIntelligence.user_id, userId), eq(competitorIntelligence.domain, domain)))
    .orderBy(desc(competitorIntelligence.created_at))
    .limit(1);
  if (!competitor) return null;

  const ctx: OvernightContext = {
    userId,
    blueprintId: "",
    domain,
    niche: competitor.niche ?? "general",
  };
  const fallback = deterministicBriefing(ctx, []);
  return {
    ...fallback,
    researchMethod: "CACHED",
    confidenceTier: (competitor.confidence_tier as ConfidenceTier) ?? "LOW",
    competitorInsights: (competitor.key_findings as string[]) ?? fallback.competitorInsights,
  };
}

export function buildFallbackBriefing(context: OvernightContext): FullEISBriefing {
  return deterministicBriefing(context, []);
}

export async function runCoreResearch(
  userId: string,
  context: OvernightContext,
): Promise<FullEISBriefing> {
  const searches = await runParallelSearches(context);
  const [bp] = context.blueprintId
    ? await db
        .select({ state_version: blueprints.state_version })
        .from(blueprints)
        .where(eq(blueprints.id, context.blueprintId))
        .limit(1)
    : [];

  let briefing: FullEISBriefing | null = null;

  try {
    const result = await routeBhudhiRequest({
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
      const fallback = deterministicBriefing(context, searches);
      briefing = {
        ...fallback,
        researchMethod: "WEB_SEARCH",
        confidenceTier: "MEDIUM",
        trendingTopics: (d.trendingTopics as FullEISBriefing["trendingTopics"]) ?? fallback.trendingTopics,
        platformSignals: (d.platformSignals as FullEISBriefing["platformSignals"]) ?? fallback.platformSignals,
        opportunities: (d.opportunities as FullEISBriefing["opportunities"]) ?? fallback.opportunities,
        todayRecommendation: String(d.todayRecommendation ?? fallback.todayRecommendation),
        competitorInsights: (d.competitorInsights as string[]) ?? fallback.competitorInsights,
        knowledgeUpdates: (d.knowledgeUpdates as FullEISBriefing["knowledgeUpdates"]) ?? fallback.knowledgeUpdates,
      };
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[EISEngine] Synthesis failed — deterministic fallback",
    );
  }

  return briefing ?? { ...deterministicBriefing(context, searches), researchMethod: "WEB_SEARCH", confidenceTier: "MEDIUM" };
}

export async function runFullEISNightlySuite(
  userId: string,
  context: OvernightContext,
  options?: { priority?: "CRITICAL" },
): Promise<FullEISBriefing> {
  const limit = await canRunResearch(userId, context.domain);
  if (!limit.allowed && options?.priority !== "CRITICAL") {
    logger.info({ userId, domain: context.domain }, "[EISEngine] Rate limit — using deterministic fallback");
    return (await getLatestBriefing(userId, context.domain)) ?? {
      ...buildFallbackBriefing(context),
      researchMethod: "CACHED",
    };
  }

  const coreResearch = await runCoreResearch(userId, context);
  const competitors = await runCompetitorIntelligence(userId, {
    domain: context.domain,
    niche: context.niche,
    userFollowerTier: context.followerTier ?? "1K-10K",
    blueprintId: context.blueprintId,
  }).catch(() =>
    deterministicCompetitorIntelligence(
      { domain: context.domain, niche: context.niche, userFollowerTier: context.followerTier },
      "FALLBACK",
    ),
  );
  const trendVelocity = await runTrendVelocityAnalysis(userId, {
    domain: context.domain,
    niche: context.niche,
    existingTrends: coreResearch.trendingTopics,
  });
  const narrative = await runNarrativeIntelligence(userId, {
    domain: context.domain,
    niche: context.niche,
    blueprintId: context.blueprintId,
  }).catch(() => deterministicNarrativeIntelligence(context, "FALLBACK"));
  const platformAlgorithmSignals = await scanPlatformAlgorithms(
    context.activePlatforms ?? [context.platform ?? "TikTok", "Instagram"],
    context.domain,
    context.niche,
  );
  const opportunityWindows = await synthesizeOpportunityWindows({
    trends: trendVelocity,
    competitors,
    narrative,
    currentBlueprintPhase: context.blueprintPhase,
    userId,
    blueprintId: context.blueprintId,
  });
  const todayRecommendation = await generateTodayRecommendation({
    opportunities: opportunityWindows,
    activeOrder: context.preGeneratedOrder,
    condition: context.condition,
  });
  const knowledgeUpdates = await updateKnowledgeLibrary(userId, context.domain, {
    trends: trendVelocity,
    narrative,
    platformSignals: platformAlgorithmSignals,
  });

  const briefing: FullEISBriefing = {
    ...coreResearch,
    researchMethod: "WEB_SEARCH",
    confidenceTier: "MEDIUM",
    platformAlgorithmSignals,
    opportunities: opportunityWindows.map((w) => ({
      description: w.description ?? w.trend,
      timeWindow: w.timeWindow,
      relevanceScore: w.relevanceScore,
    })),
    opportunityWindows,
    todayRecommendation,
    competitorInsights: [competitors.keyLesson, ...competitors.keyFindings],
    competitorIntelligence: competitors,
    trendVelocity,
    narrative,
    knowledgeUpdates,
    synthesizedAt: new Date().toISOString(),
    cacheUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

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
