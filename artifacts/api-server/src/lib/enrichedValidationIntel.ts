import type { validations } from "@workspace/db";
import type { ErectorValidationInput } from "../types/erector.js";
import type { ArchetypeResolutionOutput } from "../types/erector.js";
import { intelligenceFromRow, userGoalFromRow } from "./mapValidationIntel.js";

type ValidationRow = typeof validations.$inferSelect;

export type EnrichedCompetitor = {
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

export type EnrichedOpportunity = {
  title: string;
  impact: "High" | "Medium" | "Low";
  summary: string;
  timeWindow: string;
  marketSignal: string;
};

export type EconomicContext = {
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

const REAL_COMPANY_CRITICAL = `
CRITICAL: You must name REAL, EXISTING companies as competitors.
Use their actual brand names (e.g. "Notion", "Asana", "Shopify", "Canva").
Do NOT invent fictional company names.
Research the actual market for this domain and goal.
If you cannot identify real competitors, name the closest known alternatives.`;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  const s = String(value).trim();
  if (!s || /^not available$/i.test(s)) return fallback;
  return s;
}

function impactNorm(value: unknown): EnrichedOpportunity["impact"] {
  const v = String(value ?? "Medium").toLowerCase();
  if (v.startsWith("h")) return "High";
  if (v.startsWith("l")) return "Low";
  return "Medium";
}

function ratingNorm(value: unknown): EconomicContext["economicOpportunityRating"] {
  const v = String(value ?? "Medium").toLowerCase();
  if (v.startsWith("h")) return "High";
  if (v.startsWith("l")) return "Low";
  return "Medium";
}

function stringList(value: unknown, max = 6): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => String(x).trim()).filter(Boolean).slice(0, max);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function isFakeCompetitorName(name: string): boolean {
  return / operator \d+$/i.test(name) || /^market leader [a-c]$/i.test(name) || /^competitor \d+$/i.test(name);
}

/** Domain-aware real company fallbacks when Bhudhi is unavailable. */
export function domainFallbackCompetitors(
  domain: string,
  businessModel: string,
  goal: string,
  country: string,
): EnrichedCompetitor[] {
  const hint = `${domain} ${businessModel} ${goal}`.toLowerCase();
  const geo = country || "Global";

  const sets: Array<{ match: RegExp; companies: EnrichedCompetitor[] }> = [
    {
      match: /project|task|productivity|team|workflow|collaborat/,
      companies: [
        mkCompetitor("Notion", "All-in-one workspace for notes and projects", "2016", "$10B+ valuation", "30M+ users", geo, "35%", goal),
        mkCompetitor("Asana", "Work management for teams", "2008", "$500M+ ARR", "150,000+ paying customers", geo, "22%", goal),
        mkCompetitor("Monday.com", "Work OS for teams and workflows", "2012", "$900M+ ARR", "180,000+ customers", geo, "18%", goal),
      ],
    },
    {
      match: /shop|ecommerce|store|retail|sell online/,
      companies: [
        mkCompetitor("Shopify", "Commerce platform for online stores", "2006", "$7B+ revenue run-rate", "4.5M+ stores", geo, "28%", goal),
        mkCompetitor("WooCommerce", "Open-source ecommerce for WordPress", "2011", "Part of Automattic", "5M+ active stores", geo, "20%", goal),
        mkCompetitor("BigCommerce", "Enterprise-ready ecommerce SaaS", "2009", "$300M+ ARR", "60,000+ merchants", geo, "12%", goal),
      ],
    },
    {
      match: /design|creative|graphic|brand|visual/,
      companies: [
        mkCompetitor("Canva", "Design platform for everyone", "2013", "$2B+ ARR", "170M+ monthly users", geo, "40%", goal),
        mkCompetitor("Figma", "Collaborative interface design", "2012", "Acquired by Adobe", "4M+ users", geo, "25%", goal),
        mkCompetitor("Adobe Express", "Quick creative assets for marketers", "2021", "Adobe ecosystem", "Hundreds of millions via Creative Cloud", geo, "15%", goal),
      ],
    },
    {
      match: /crm|sales|lead|customer/,
      companies: [
        mkCompetitor("HubSpot", "Inbound CRM and marketing platform", "2006", "$2B+ ARR", "228,000+ customers", geo, "30%", goal),
        mkCompetitor("Salesforce", "Enterprise CRM and cloud apps", "1999", "$35B+ revenue", "150,000+ businesses", geo, "35%", goal),
        mkCompetitor("Pipedrive", "Sales CRM for small teams", "2010", "$100M+ ARR", "100,000+ companies", geo, "10%", goal),
      ],
    },
    {
      match: /learn|course|education|coach|training/,
      companies: [
        mkCompetitor("Udemy", "Global marketplace for courses", "2010", "$700M+ revenue", "74M+ learners", geo, "25%", goal),
        mkCompetitor("Teachable", "Creator-led course platform", "2014", "Part of Hotmart", "100,000+ creators", geo, "18%", goal),
        mkCompetitor("Kajabi", "All-in-one for knowledge businesses", "2010", "$100M+ ARR", "50,000+ businesses", geo, "12%", goal),
      ],
    },
  ];

  for (const set of sets) {
    if (set.match.test(hint)) return set.companies;
  }

  return [
    mkCompetitor("Stripe", "Payments infrastructure for the internet", "2010", "$1T+ processed annually", "Millions of businesses", geo, "Market leader", goal),
    mkCompetitor("Zapier", "Workflow automation between apps", "2011", "$140M+ ARR", "2.2M+ businesses", geo, "22%", goal),
    mkCompetitor("Mailchimp", "Email and marketing automation", "2001", "Intuit ecosystem", "13M+ users", geo, "18%", goal),
  ];
}

function mkCompetitor(
  name: string,
  tagline: string,
  founded: string,
  revenue: string,
  users: string,
  geography: string,
  marketShare: string,
  goal: string,
): EnrichedCompetitor {
  const goalSnippet = goal.split(/\s+/).slice(0, 12).join(" ") || "your idea";
  return {
    name,
    tagline,
    description: `${name} is a well-known operator in this space with ${users} and ${revenue}. They compete on brand, distribution, and product breadth.`,
    founded,
    estimatedRevenue: revenue,
    userBase: users,
    geography,
    strengths: ["Strong brand recognition", "Mature product ecosystem", "Proven monetization"],
    weaknesses: ["Premium pricing for full features", "Slower innovation in niche use cases", "Broad positioning leaves gaps"],
    marketShare,
    whereYourIdeaFits: `Your idea (${goalSnippet}) can differentiate from ${name} by narrowing the wedge, proving outcomes faster for a specific segment, and avoiding their full-suite complexity.`,
  };
}

export function mapCompetitorRaw(c: Record<string, unknown>): EnrichedCompetitor {
  const desc = str(c.description ?? c.summary ?? c.positioningStrategy ?? c.positioning_strategy, "");
  const tagline = str(c.tagline, desc ? desc.split(".")[0]?.trim() ?? "" : "");
  return {
    name: str(c.name ?? c.competitorName, "Unknown"),
    tagline: tagline === "Not available" ? "" : tagline,
    description: desc || tagline,
    founded: str(c.founded, "Not available"),
    estimatedRevenue: str(c.estimatedRevenue ?? c.revenue, "Not available"),
    userBase: str(c.userBase ?? c.users, "Not available"),
    geography: str(c.geography ?? c.location, "Global"),
    strengths: stringList(c.strengths ?? c.strength_points ?? c.survivorPatterns, 5),
    weaknesses: stringList(c.weaknesses ?? c.weakness_points ?? c.strategicGapForUser, 5),
    marketShare: str(c.marketShare ?? c.market_share, "Not available"),
    whereYourIdeaFits: str(c.whereYourIdeaFits ?? c.positioning ?? c.strategicGapForUser, ""),
  };
}

export function mapOpportunityRaw(o: Record<string, unknown>): EnrichedOpportunity {
  return {
    title: str(o.title ?? o.name, "Market opportunity"),
    impact: impactNorm(o.impact),
    summary: str(o.summary ?? o.description, ""),
    timeWindow: str(o.timeWindow ?? o.time_window, "—"),
    marketSignal: str(o.marketSignal ?? o.signal, ""),
  };
}

export function mapEconomicContextRaw(
  raw: Record<string, unknown> | null,
  country: string,
  goal: string,
): EconomicContext {
  const r = raw ?? {};
  const fallbackSummary =
    country && country !== "Unknown"
      ? `Operating in ${country}, your idea should align with local purchasing power, trust norms, and distribution channels before scaling.`
      : "Economic data not available for this validation.";

  return {
    country: str(r.country, country || "Unknown"),
    region: str(r.region, "Not available"),
    economicZone: str(r.economicZone ?? r.economic_zone, "Not available"),
    gdpContext: str(r.gdpContext ?? r.gdp_context, "Not available"),
    marketMaturity: str(r.marketMaturity ?? r.market_maturity, "Not available"),
    digitalPenetration: str(r.digitalPenetration ?? r.digital_penetration, "Not available"),
    politicalClimate: str(r.politicalClimate ?? r.political_climate, "Not available"),
    regulatoryEnvironment: str(r.regulatoryEnvironment ?? r.regulatory_environment, "Not available"),
    localMarketDynamics: str(r.localMarketDynamics ?? r.local_market_dynamics, fallbackSummary),
    globalMarketAccess: str(r.globalMarketAccess ?? r.global_market_access, "Not available"),
    economicOpportunityRating: ratingNorm(r.economicOpportunityRating ?? r.economic_opportunity_rating),
    economicSummary: str(r.economicSummary ?? r.economic_summary ?? r.briefingNarrative, fallbackSummary),
  };
}

function competitorListFromUnknown(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const obj = asRecord(raw);
  if (!obj) return [];
  if (Array.isArray(obj.competitors)) return obj.competitors;
  if (Array.isArray(obj.winners)) return obj.winners;
  return [];
}

export function extractEnrichedFromOutputs(
  outputs: {
    competitorAnalysis: Record<string, unknown>;
    marketAnalysis: Record<string, unknown>;
    economyBriefing: Record<string, unknown>;
  },
  input: ErectorValidationInput,
  archetype: ArchetypeResolutionOutput,
): {
  competitors: EnrichedCompetitor[];
  opportunities: EnrichedOpportunity[];
  economicContext: EconomicContext;
} {
  const country = input.location.country || "Unknown";
  const goal = input.rawGoal || input.purpose;
  const domain = input.domainHint || input.businessModel || "";

  const rawCompetitors = competitorListFromUnknown(outputs.competitorAnalysis);
  let competitors = rawCompetitors
    .map((c) => mapCompetitorRaw(c as Record<string, unknown>))
    .filter((c) => c.name !== "Unknown" && !isFakeCompetitorName(c.name))
    .slice(0, 3);

  if (competitors.length < 3) {
    const fallbacks = domainFallbackCompetitors(domain, input.businessModel, goal, country);
    for (const fb of fallbacks) {
      if (competitors.length >= 3) break;
      if (!competitors.some((c) => c.name.toLowerCase() === fb.name.toLowerCase())) {
        competitors.push(fb);
      }
    }
  }
  competitors = competitors.slice(0, 3);

  const market = asRecord(outputs.marketAnalysis) ?? {};
  const marketOpps = asArray(market.opportunities);
  const briefing = asRecord(outputs.economyBriefing) ?? {};
  const briefingOpps = asArray(briefing.keyOpportunities ?? briefing.opportunities);

  const opportunityItems = [...marketOpps, ...briefingOpps]
    .map((o) => {
      if (typeof o === "string") {
        return mapOpportunityRaw({
          title: o,
          impact: "Medium",
          summary: o,
          timeWindow: "6-12 months",
          marketSignal: "Observed demand in your target market.",
        });
      }
      return mapOpportunityRaw(o as Record<string, unknown>);
    })
    .filter((o) => o.title.length > 0);

  const opportunities =
    opportunityItems.length > 0
      ? opportunityItems.slice(0, 5)
      : [
          mapOpportunityRaw({
            title: "Underserved niche within your domain",
            impact: "High",
            summary:
              "A focused segment in your market shows unmet demand. Buyers want faster proof and simpler offers than incumbents provide. You can capture this by narrowing positioning, publishing case studies, and selling a single outcome first.",
            timeWindow: "6-12 months",
            marketSignal: "Rising search and community discussion around your problem category.",
          }),
        ];

  const econRaw =
    asRecord(briefing.economicContext) ??
    asRecord(briefing.economy_briefing) ??
    briefing;
  let economicContext = mapEconomicContextRaw(econRaw, country, goal);
  if (economicContext.economicSummary === "Economic data not available for this validation.") {
    const narrative = str(briefing.briefingNarrative ?? briefing.summary, "");
    if (narrative) {
      economicContext = {
        ...economicContext,
        economicSummary: narrative,
        localMarketDynamics: narrative,
      };
    }
  }

  return { competitors, opportunities, economicContext };
}

export function enrichedFromValidationRow(row: ValidationRow): {
  competitors: EnrichedCompetitor[];
  opportunities: EnrichedOpportunity[];
  economicContext: EconomicContext;
} {
  const intel = intelligenceFromRow(row);
  const country = String(row.location_country ?? intel.locationCountry ?? "Unknown");

  const rowExt = row as ValidationRow & {
    enriched_competitors?: EnrichedCompetitor[] | null;
    enriched_opportunities?: EnrichedOpportunity[] | null;
    economic_context?: EconomicContext | null;
  };
  const storedCompetitors = rowExt.enriched_competitors ?? null;
  const storedOpportunities = rowExt.enriched_opportunities ?? null;
  const storedEconomic = rowExt.economic_context ?? null;

  if (storedCompetitors?.length) {
    return {
      competitors: storedCompetitors.slice(0, 3),
      opportunities: storedOpportunities ?? [],
      economicContext: storedEconomic ?? mapEconomicContextRaw(null, country, userGoalFromRow(row)),
    };
  }

  const fromIntelCompetitors = competitorListFromUnknown(
    intel.competitors ?? intel.enriched_competitors ?? intel.competitor_analysis,
  )
    .map((c) => mapCompetitorRaw(c as Record<string, unknown>))
    .filter((c) => !isFakeCompetitorName(c.name))
    .slice(0, 3);

  const competitors =
    fromIntelCompetitors.length > 0
      ? fromIntelCompetitors
      : domainFallbackCompetitors(
          String(row.domain ?? ""),
          String(row.business_model ?? ""),
          userGoalFromRow(row),
          country,
        ).slice(0, 3);

  const oppsRaw = asArray(intel.opportunities ?? intel.enriched_opportunities ?? intel.primaryOpportunityFactors);
  const opportunities = oppsRaw.length
    ? oppsRaw.map((o) =>
        typeof o === "string"
          ? mapOpportunityRaw({ title: o, summary: o, impact: "Medium" })
          : mapOpportunityRaw(o as Record<string, unknown>),
      )
    : [];

  const economicContext = mapEconomicContextRaw(
    (intel.economicContext ?? intel.economy_briefing ?? storedEconomic) as Record<string, unknown> | null,
    country,
    userGoalFromRow(row),
  );

  return { competitors, opportunities, economicContext };
}

export function mapCompetitorsForApi(competitors: EnrichedCompetitor[]) {
  return competitors.slice(0, 3).map((c) => ({
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    founded: c.founded,
    estimatedRevenue: c.estimatedRevenue,
    userBase: c.userBase,
    geography: c.geography,
    strengths: c.strengths,
    weaknesses: c.weaknesses,
    marketShare: c.marketShare,
    whereYourIdeaFits: c.whereYourIdeaFits,
  }));
}

export function mapOpportunitiesForApi(opportunities: EnrichedOpportunity[]) {
  return opportunities.map((o) => ({
    title: o.title,
    impact: o.impact,
    summary: o.summary,
    timeWindow: o.timeWindow,
    marketSignal: o.marketSignal,
  }));
}

export { REAL_COMPANY_CRITICAL };
