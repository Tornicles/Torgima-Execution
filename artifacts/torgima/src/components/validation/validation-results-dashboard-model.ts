import type { PathKey } from "./PathPanels";
import type { ValidationScreenData } from "./ValidationScreen";
import {
  buildViewModel,
  parsePath,
  scoreOn10,
  type ValidationViewModel,
} from "./validation-results-helpers";
import { loadPreValidationDraft, formatDisplayDate } from "@/lib/pre-validation-draft";

export type StatusTone = "green" | "orange" | "red" | "gray" | "purple";

export type GlanceRow = { label: string; value: string; tone: StatusTone };

export type CompetitorCard = {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  marketShare: number;
};

export type EnrichedCompetitorCard = {
  name: string;
  tagline: string;
  description: string;
  founded: string;
  estimatedRevenue: string;
  userBase: string;
  geography: string;
  strengths: string[];
  weaknesses: string[];
  marketShare: string;
  whereYourIdeaFits: string;
};

export type EnrichedOpportunityCard = {
  title: string;
  impact: "High" | "Medium" | "Low";
  summary: string;
  timeWindow: string;
  marketSignal: string;
};

export type EconomicContextModel = {
  country: string;
  region: string;
  economicZone: string;
  gdpContext: string;
  marketMaturity: string;
  digitalPenetration: string;
  politicalClimate: string;
  regulatoryEnvironment: string;
  localMarketDynamics: string;
  globalMarketAccess: string;
  economicOpportunityRating: "High" | "Medium" | "Low";
  economicSummary: string;
};

export type OpportunityRow = { title: string; impact: "High Impact" | "Medium Impact" | "Low Impact" };

export type PathCardModel = {
  key: PathKey;
  title: string;
  badge?: string;
  successPotential: string;
  growthPotential: string;
  timeToTraction: string;
  estimatedOutcome: string;
};

export type RiskRow = { title: string; level: "Low" | "Medium" | "High"; explanation: string };

export type MilestoneRow = { step: number; title: string; timing: string };

export type ResultsDashboardModel = ValidationViewModel & {
  ideaTitle: string;
  ideaSubtitle: string;
  timeframeLabel: string;
  contextLabel: string;
  selectedDirectionLabel: string;
  realityLabel: string;
  realityDescription: string;
  verdictUpper: string;
  verdictDescription: string;
  confidenceBadge: string;
  atAGlance: GlanceRow[];
  trendPosition: string;
  growthRate: string;
  chartYears: string[];
  chartValues: number[];
  competitorCards: CompetitorCard[];
  enrichedCompetitors: EnrichedCompetitorCard[];
  enrichedOpportunities: EnrichedOpportunityCard[];
  economicContext: EconomicContextModel;
  pros: string[];
  cons: string[];
  opportunities: OpportunityRow[];
  pathCards: PathCardModel[];
  risks: RiskRow[];
  milestones: MilestoneRow[];
};

function scoreStatus(score: number, invert = false): { value: string; tone: StatusTone } {
  const good = invert ? score <= 4 : score >= 7;
  const mid = invert ? score <= 6 : score >= 4;
  if (good) return { value: invert ? "Low" : "Good", tone: "green" };
  if (mid) return { value: "Moderate", tone: "orange" };
  return { value: invert ? "High" : "Weak", tone: "red" };
}

function verdictUpper(verdict: string): string {
  if (verdict === "proceed") return "PROCEED";
  if (verdict === "pivot") return "PIVOT";
  if (verdict === "blocked") return "STOP";
  if (verdict === "adjust") return "ADJUST";
  return verdict.toUpperCase() || "ADJUST";
}

function verdictDescription(verdict: string): string {
  if (verdict === "proceed") return "This direction is worth pursuing.";
  if (verdict === "pivot") return "A pivot will improve your odds of success.";
  if (verdict === "blocked") return "Address critical gaps before committing resources.";
  return "Proceed with the recommended adjustments.";
}

function confidenceBadge(verdict: string, pct: number): string {
  if (verdict === "proceed" && pct >= 75) return "Strong Foundation";
  if (pct >= 65) return "Solid Potential";
  if (pct >= 50) return "Promising with Adjustments";
  return "Needs Refinement";
}

function realityLabel(pct: number): string {
  if (pct >= 80) return "Excellent Potential";
  if (pct >= 70) return "Good Potential";
  if (pct >= 55) return "Moderate Potential";
  return "Needs Strengthening";
}

function realityDescription(pct: number): string {
  if (pct >= 70) {
    return "Your idea has good potential in the current market. Proceed with confidence with recommended adjustments.";
  }
  if (pct >= 55) {
    return "Your idea shows promise with some gaps to address. Focus on the recommended path adjustments.";
  }
  return "Your idea needs refinement before full execution. Use the adjusted path to improve viability.";
}

function stringList(value: unknown, max: number): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(0, max);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function competitorCard(c: Record<string, unknown>, index: number): CompetitorCard {
  const name = String(c.name ?? `Competitor ${index + 1}`);
  const strengths = stringList(
    c.survivorBehaviours ?? c.survivor_behaviours ?? c.strengths,
    4,
  );
  const weaknesses = stringList(
    c.strategicGapForUser ?? c.strategic_gap_for_user ?? c.weaknesses,
    4,
  );
  const shareRaw = Number(c.marketShare ?? c.market_share);
  const marketShare = Number.isFinite(shareRaw)
    ? Math.min(100, Math.max(5, shareRaw <= 1 ? shareRaw * 100 : shareRaw))
    : [38, 27, 18][index] ?? 15;

  return {
    name,
    description: String(
      c.positioningStrategy ?? c.positioning_strategy ?? c.description ?? `${name} serves a similar audience.`,
    ),
    strengths:
      strengths.length > 0
        ? strengths
        : ["Strong brand presence", "Established user base"],
    weaknesses:
      weaknesses.length > 0
        ? weaknesses.map((w) => (w.length > 80 ? `${w.slice(0, 77)}…` : w))
        : ["Premium pricing", "Broad positioning"],
    marketShare: Math.round(marketShare),
  };
}

function impactNorm(value: unknown): EnrichedOpportunityCard["impact"] {
  const v = String(value ?? "Medium").toLowerCase();
  if (v.startsWith("h")) return "High";
  if (v.startsWith("l")) return "Low";
  return "Medium";
}

function parseEnrichedCompetitor(c: Record<string, unknown>): EnrichedCompetitorCard {
  const desc = String(c.description ?? c.summary ?? "");
  return {
    name: String(c.name ?? "Unknown"),
    tagline: String(c.tagline ?? (desc ? desc.split(".")[0] : "")),
    description: desc || String(c.tagline ?? ""),
    founded: String(c.founded ?? "Not available"),
    estimatedRevenue: String(c.estimatedRevenue ?? c.revenue ?? "Not available"),
    userBase: String(c.userBase ?? c.users ?? "Not available"),
    geography: String(c.geography ?? c.location ?? "Global"),
    strengths: stringList(c.strengths, 5),
    weaknesses: stringList(c.weaknesses, 5),
    marketShare: String(c.marketShare ?? c.market_share ?? "Not available"),
    whereYourIdeaFits: String(c.whereYourIdeaFits ?? c.positioning ?? ""),
  };
}

function parseEnrichedOpportunity(o: Record<string, unknown>): EnrichedOpportunityCard {
  return {
    title: String(o.title ?? o.name ?? "Opportunity"),
    impact: impactNorm(o.impact),
    summary: String(o.summary ?? o.description ?? ""),
    timeWindow: String(o.timeWindow ?? o.time_window ?? "Not available"),
    marketSignal: String(o.marketSignal ?? o.signal ?? ""),
  };
}

function defaultEconomic(country: string): EconomicContextModel {
  return {
    country: country || "Your market",
    region: "Not available",
    economicZone: "Not available",
    gdpContext: "Not available",
    marketMaturity: "Not available",
    digitalPenetration: "Not available",
    politicalClimate: "Not available",
    regulatoryEnvironment: "Not available",
    localMarketDynamics: "Economic data not available for this validation.",
    globalMarketAccess: "Not available",
    economicOpportunityRating: "Medium",
    economicSummary: "Economic data not available for this validation.",
  };
}

function parseEconomic(raw: Record<string, unknown> | undefined, country: string): EconomicContextModel {
  if (!raw) return defaultEconomic(country);
  const rating = String(raw.economicOpportunityRating ?? raw.economic_opportunity_rating ?? "Medium");
  return {
    country: String(raw.country ?? country),
    region: String(raw.region ?? "Not available"),
    economicZone: String(raw.economicZone ?? raw.economic_zone ?? "Not available"),
    gdpContext: String(raw.gdpContext ?? raw.gdp_context ?? "Not available"),
    marketMaturity: String(raw.marketMaturity ?? raw.market_maturity ?? "Not available"),
    digitalPenetration: String(raw.digitalPenetration ?? raw.digital_penetration ?? "Not available"),
    politicalClimate: String(raw.politicalClimate ?? raw.political_climate ?? "Not available"),
    regulatoryEnvironment: String(raw.regulatoryEnvironment ?? raw.regulatory_environment ?? "Not available"),
    localMarketDynamics: String(raw.localMarketDynamics ?? raw.local_market_dynamics ?? "Not available"),
    globalMarketAccess: String(raw.globalMarketAccess ?? raw.global_market_access ?? "Not available"),
    economicOpportunityRating: impactNorm(rating) as EconomicContextModel["economicOpportunityRating"],
    economicSummary: String(raw.economicSummary ?? raw.economic_summary ?? raw.briefingNarrative ?? "Not available"),
  };
}

function defaultEnrichedCompetitors(): EnrichedCompetitorCard[] {
  return defaultCompetitors().map((c) => ({
    name: c.name,
    tagline: c.description,
    description: c.description,
    founded: "Not available",
    estimatedRevenue: "Not available",
    userBase: "Not available",
    geography: "Global",
    strengths: c.strengths,
    weaknesses: c.weaknesses,
    marketShare: `${c.marketShare}%`,
    whereYourIdeaFits: "Your idea can differentiate through a narrower wedge and faster proof for a specific segment.",
  }));
}

function defaultCompetitors(): CompetitorCard[] {
  return [
    {
      name: "Market Leader A",
      description: "Established player in your space.",
      strengths: ["Strong brand", "Large user base"],
      weaknesses: ["Expensive", "Slow to innovate"],
      marketShare: 34,
    },
    {
      name: "Market Leader B",
      description: "Fast-growing alternative.",
      strengths: ["Modern UX", "Aggressive marketing"],
      weaknesses: ["Limited support", "Narrow features"],
      marketShare: 24,
    },
    {
      name: "Market Leader C",
      description: "Niche-focused competitor.",
      strengths: ["Specialized offer", "Loyal community"],
      weaknesses: ["Small scale", "Regional focus"],
      marketShare: 16,
    },
  ];
}

function impactFromIndex(i: number): OpportunityRow["impact"] {
  if (i < 2) return "High Impact";
  if (i < 4) return "Medium Impact";
  return "Low Impact";
}

function pathPotential(path: Record<string, unknown>, key: PathKey): PathCardModel {
  const growth = path.growthPotential ?? path.growth_potential;
  const traction = String(path.timeToTraction ?? path.time_to_traction ?? path.timeline ?? "—");
  const risk = String(path.riskLevel ?? path.risk_level ?? "Medium");
  const success =
    Number(growth) >= 70 || risk.toLowerCase() === "low"
      ? "High"
      : Number(growth) >= 45
        ? "Medium"
        : "Moderate";

  const titles: Record<PathKey, string> = {
    adjusted: "Adjusted Path",
    current: "Current Path",
    alternative: "Alternative Path",
  };

  return {
    key,
    title: titles[key],
    badge: key === "adjusted" ? "Recommended" : undefined,
    successPotential: `${success} success potential`,
    growthPotential: growth != null ? `${growth}% growth` : "Strong growth potential",
    timeToTraction: traction,
    estimatedOutcome: String(
      path.outcomeProjection ?? path.expectedOutcome ?? path.expected_outcome ?? path.summary ?? "—",
    ),
  };
}

function defaultMilestones(): MilestoneRow[] {
  return [
    { step: 1, title: "Define Niche & Offer", timing: "Week 1–2" },
    { step: 2, title: "Build Core Service & Systems", timing: "Week 3–6" },
    { step: 3, title: "Get First 5 Paying Clients", timing: "Month 2–3" },
    { step: 4, title: "Build Case Studies & Referrals", timing: "Month 4–6" },
    { step: 5, title: "Scale & Automate Operations", timing: "Month 7–12" },
  ];
}

function extractMilestones(erector: Record<string, unknown>): MilestoneRow[] {
  const raw = erector.first_week_plan ?? erector.firstWeekPlan;
  if (!raw) return defaultMilestones();

  const items: { title: string; timing: string }[] = [];
  if (Array.isArray(raw)) {
    raw.slice(0, 5).forEach((item, i) => {
      const row = item as Record<string, unknown>;
      items.push({
        title: String(row.title ?? row.name ?? `Milestone ${i + 1}`),
        timing: String(row.timing ?? row.week ?? `Week ${i + 1}`),
      });
    });
  } else if (typeof raw === "object" && raw !== null) {
    const days = (raw as { days?: unknown[] }).days;
    if (Array.isArray(days)) {
      days.slice(0, 5).forEach((d, i) => {
        const day = d as { day?: number; actions?: Array<Record<string, unknown>> };
        const action = day.actions?.[0];
        items.push({
          title: String(action?.title ?? `Milestone ${i + 1}`),
          timing: `Day ${day.day ?? i + 1}`,
        });
      });
    }
  }

  if (items.length === 0) return defaultMilestones();
  return items.map((m, i) => ({ step: i + 1, ...m }));
}

function directionLabel(path: PathKey): string {
  if (path === "adjusted") return "Adjusted Path (Best Fit)";
  if (path === "alternative") return "Alternative Path (Pivot)";
  return "Current Path (As Is)";
}

function formatTimeframe(erector: Record<string, unknown>): string {
  const tf = String(erector.timeframe ?? "").trim();
  if (tf && !/^\d+d$/i.test(tf)) return tf;

  const days = Number(erector.timeframeDays ?? erector.timeframe_days);
  const draft = loadPreValidationDraft();
  const effectiveDays =
    Number.isFinite(days) && days > 0 ? days : draft.timeframeDays > 0 ? draft.timeframeDays : null;

  if (draft.startDate && draft.endDate) {
    return `${formatDisplayDate(draft.startDate)} – ${formatDisplayDate(draft.endDate)}`;
  }

  if (effectiveDays != null) {
    const months = Math.round(effectiveDays / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }

  return "—";
}

export function buildResultsDashboardModel(
  data: ValidationScreenData,
  selectedPath: PathKey,
): ResultsDashboardModel {
  const vm = buildViewModel(data);
  const erector = vm.erector;
  const executionScore = scoreOn10(vm.scores.executionScore ?? erector.execution_score);
  const feasibilityScore = scoreOn10(vm.scores.feasibilityScore ?? vm.scores.blueprintDifficultyScore);

  const archetype = (erector.archetypeResolution ?? erector.archetype_resolution ?? {}) as Record<
    string,
    unknown
  >;
  const briefing = (erector.economyBriefing ?? erector.economy_briefing ?? {}) as Record<string, unknown>;

  const pros = stringList(
    erector.industryPros ?? erector.industry_pros ?? archetype.economySpecificOpportunities,
    6,
  );
  const cons = stringList(
    vm.industryCons.length > 0 ? vm.industryCons : erector.industryCons ?? erector.industry_cons,
    6,
  );

  const opportunitiesRaw = stringList(
    pros.length > 0 ? pros : briefing.keyOpportunities ?? archetype.economySpecificOpportunities,
    5,
  );

  const erectorCompetitors = Array.isArray(erector.competitors)
    ? (erector.competitors as Record<string, unknown>[])
    : [];
  const enrichedCompetitors =
    erectorCompetitors.length > 0
      ? erectorCompetitors.slice(0, 3).map(parseEnrichedCompetitor)
      : defaultEnrichedCompetitors();

  const erectorOpportunities = Array.isArray(erector.opportunities)
    ? (erector.opportunities as Record<string, unknown>[])
    : [];
  const enrichedOpportunities =
    erectorOpportunities.length > 0
      ? erectorOpportunities.map(parseEnrichedOpportunity)
      : [];

  const economicContext = parseEconomic(
    (erector.economicContext ?? erector.economic_context) as Record<string, unknown> | undefined,
    vm.locationCountry,
  );

  const competitors =
    vm.competitors.length > 0
      ? vm.competitors.slice(0, 3).map((c, i) => competitorCard(c, i))
      : defaultCompetitors();

  const timingGrowth = vm.timingScore >= 7 ? "+27% YoY" : vm.timingScore >= 4 ? "+14% YoY" : "+6% YoY";
  const trendPosition =
    vm.timingScore >= 7 ? "Early Growth" : vm.timingScore >= 4 ? "Stable Growth" : "Mature Market";

  const chartValues = [
    42,
    48,
    Math.min(95, 52 + vm.timingScore * 4),
    Math.min(98, 58 + vm.marketScore * 3),
    Math.min(100, 62 + vm.momentumScore * 3),
  ];

  const risks: RiskRow[] = [
    {
      title: "Execution Risk",
      level: executionScore >= 7 ? "Low" : executionScore >= 4 ? "Medium" : "High",
      explanation:
        executionScore >= 7
          ? "Your skills and resources align well with this build."
          : "Delivery complexity may require additional support or phased scope.",
    },
    {
      title: "Distribution Risk",
      level: vm.competitionScore >= 7 ? "High" : vm.competitionScore >= 4 ? "Medium" : "Low",
      explanation:
        vm.competitionScore >= 7
          ? "Reaching your target audience may require additional strategy."
          : "Distribution channels look accessible with focused outreach.",
    },
    {
      title: "Consistency Risk",
      level: ["high", "intense"].includes(vm.commitmentLevel.toLowerCase()) ? "Low" : "Medium",
      explanation:
        ["high", "intense"].includes(vm.commitmentLevel.toLowerCase())
          ? "Your weekly commitment supports steady execution."
          : "Sustained weekly effort will be important to hit milestones.",
    },
    {
      title: "Market Risk",
      level: vm.marketScore >= 7 ? "Low" : vm.marketScore >= 4 ? "Medium" : "High",
      explanation:
        vm.marketScore >= 7
          ? "Market demand signals are favorable for launch."
          : "Validate demand with a narrow offer before scaling spend.",
    },
  ];

  const pathCards: PathCardModel[] = (
    ["adjusted", "current", "alternative"] as PathKey[]
  ).map((key) => pathPotential(vm.paths[key], key));

  const defaultPros = [
    "Growing market",
    "Real problem to solve",
    "Remote-friendly model",
    "Multiple revenue paths",
    "Low barrier to start",
  ];
  const defaultCons = [
    "Competitive market",
    "Strong positioning required",
    "Customer acquisition takes time",
    "Execution complexity",
  ];

  return {
    ...vm,
    ideaTitle: vm.rawGoal.split(/[.!?]/)[0]?.trim() || "Your Idea",
    ideaSubtitle: vm.purpose,
    timeframeLabel: formatTimeframe(erector),
    contextLabel: `${vm.locationCountry} · ${vm.commitmentLevel} commitment`,
    selectedDirectionLabel: directionLabel(selectedPath),
    realityLabel: realityLabel(vm.ringPct),
    realityDescription: realityDescription(vm.ringPct),
    verdictUpper: verdictUpper(vm.verdict),
    verdictDescription: verdictDescription(vm.verdict),
    confidenceBadge: confidenceBadge(vm.verdict, vm.ringPct),
    atAGlance: [
      { label: "Problem Exists", value: vm.marketScore >= 5 ? "Yes" : "Unclear", tone: "green" },
      { label: "Market Demand", ...scoreStatus(vm.marketScore) },
      { label: "Competition Level", ...scoreStatus(vm.competitionScore, true) },
      { label: "Execution Fit", ...scoreStatus(executionScore) },
      { label: "Feasibility", ...scoreStatus(feasibilityScore) },
      { label: "Timing", value: vm.timingScore >= 6 ? "Favorable" : "Moderate", tone: vm.timingScore >= 6 ? "green" : "orange" },
      {
        label: "Execution Readiness",
        value: vm.ringPct >= 70 ? "Good" : vm.ringPct >= 50 ? "Moderate" : "Weak",
        tone: vm.ringPct >= 70 ? "green" : vm.ringPct >= 50 ? "orange" : "red",
      },
    ],
    trendPosition,
    growthRate: timingGrowth,
    chartYears: ["2023", "2024", "2025", "2026", "2027"],
    chartValues,
    competitorCards: competitors,
    enrichedCompetitors,
    enrichedOpportunities:
      enrichedOpportunities.length > 0
        ? enrichedOpportunities
        : [
            {
              title: "Underserved niche within your domain",
              impact: "High" as const,
              summary:
                "A focused segment shows unmet demand. Buyers want faster proof than incumbents provide. Capture this with narrow positioning and a single-outcome offer.",
              timeWindow: "6-12 months",
              marketSignal: "Rising interest in your problem category.",
            },
          ],
    economicContext,
    pros: pros.length > 0 ? pros : defaultPros,
    cons: cons.length > 0 ? cons.slice(0, 5) : defaultCons,
    opportunities:
      enrichedOpportunities.length > 0
        ? enrichedOpportunities.map((o) => ({
            title: o.title,
            impact:
              o.impact === "High"
                ? ("High Impact" as const)
                : o.impact === "Low"
                  ? ("Low Impact" as const)
                  : ("Medium Impact" as const),
          }))
        : opportunitiesRaw.length > 0
          ? opportunitiesRaw.map((title, i) => ({ title, impact: impactFromIndex(i) }))
          : [
              { title: "Underserved creators", impact: "High Impact" },
              { title: "Done-for-you systems", impact: "High Impact" },
              { title: "Workflow automation", impact: "Medium Impact" },
            ],
    pathCards,
    risks,
    milestones: extractMilestones(erector),
  };
}

export { parsePath, directionLabel };
