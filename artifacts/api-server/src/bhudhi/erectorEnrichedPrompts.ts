import type { BhudhiTriggerType } from "../types/bhudhi.js";
import type { PromptContract } from "./PromptRegistry.js";
import { ERECTOR_JSON_PREFIX, buildErectorFactsContext } from "./erectorWebSearch.js";
import { REAL_COMPANY_CRITICAL } from "../lib/enrichedValidationIntel.js";

const STANDARD_HEADER = `
The rule engine owns all scores and launch decisions. Use probability language only.
Return ONLY valid JSON matching the envelope below.`;

function envelope(outputType: string, dataShape: string, stateVersion: unknown) {
  return `
Return ONLY JSON:
{
  "outputType": "${outputType}",
  "contractVersion": "1.0",
  "stateVersion": ${stateVersion ?? 0},
  "confidence": "MEDIUM",
  "data": ${dataShape},
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`;
}

export function registerErectorEnrichedPrompts(registry: Map<BhudhiTriggerType, PromptContract>): void {
  const competitorsData = `{
    "summary": "Competitive landscape for the user's goal in their market",
    "warnings": [],
    "opportunities": [],
    "competitors": [
      {
        "name": "Exact company name (e.g. Notion, Asana, Monday.com)",
        "tagline": "One line describing what they do",
        "description": "2-3 sentence summary of what this company is, what it does, and its scale",
        "founded": "year or approximate",
        "estimatedRevenue": "e.g. $100M ARR or $50M+ revenue",
        "userBase": "e.g. 20M+ users or 50,000+ businesses",
        "geography": "where they operate primarily",
        "strengths": ["strength 1", "strength 2", "strength 3"],
        "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
        "marketShare": "e.g. 18% or market leader",
        "whereYourIdeaFits": "2-3 sentences explaining exactly how the user's idea relates to this competitor — where it overlaps, where it differs, and what gap the user can exploit"
      }
    ]
  }`;

  const marketData = `{
    "summary": "Market analysis for the user's goal",
    "warnings": [],
    "opportunities": [
      {
        "title": "Short opportunity title",
        "impact": "High | Medium | Low",
        "summary": "Full summary in maximum 100 words explaining what this opportunity is, why it exists right now, who it serves, and what action would capture it",
        "timeWindow": "e.g. 6-12 months or immediate",
        "marketSignal": "one sentence describing the data signal that confirms this opportunity exists"
      }
    ],
    "demandScore": 0,
    "competitionScore": 0
  }`;

  const economyData = `{
    "summary": "Economy briefing for the user's location",
    "warnings": [],
    "opportunities": [],
    "briefingNarrative": "2-3 sentence narrative",
    "economicContext": {
      "country": "user's country from their location input",
      "region": "e.g. North America, Sub-Saharan Africa, Southeast Asia",
      "economicZone": "e.g. USD economy, Euro zone, emerging market, frontier market",
      "gdpContext": "brief note on GDP per capita and what it means for purchasing power in this market",
      "marketMaturity": "developed | developing | emerging | frontier",
      "digitalPenetration": "e.g. 85% internet penetration — high digital readiness",
      "politicalClimate": "stable | moderate risk | high risk — one sentence on current political environment relevant to business",
      "regulatoryEnvironment": "one sentence on how easy or hard it is to operate a business in this country",
      "localMarketDynamics": "2-3 sentences on how the local market behaves — consumer behavior, payment methods, trust factors, competition density",
      "globalMarketAccess": "one sentence on whether this idea can expand globally from this location or is primarily local",
      "economicOpportunityRating": "High | Medium | Low — overall rating of how favorable this economic environment is for this idea",
      "economicSummary": "3-4 sentence overall summary combining all economic factors and what they mean for the user's specific idea"
    }
  }`;

  const existingCompetitors = registry.get("ERECTOR_COMPETITORS_IDENTIFY");
  if (existingCompetitors) {
    registry.set("ERECTOR_COMPETITORS_IDENTIFY", {
      ...existingCompetitors,
      maxTokens: 2400,
      systemPrompt:
        ERECTOR_JSON_PREFIX +
        STANDARD_HEADER +
        `\nYou are supporting The Erector validation system. Identify the top real competitors for the user's goal.` +
        REAL_COMPANY_CRITICAL,
      buildUserPrompt: (ctx) =>
        `${buildErectorFactsContext(ctx)}\n${envelope("erector_competitors", competitorsData, ctx["stateVersion"])}`,
    });
  }

  const existingMarket = registry.get("ERECTOR_MARKET_ANALYZE");
  if (existingMarket) {
    registry.set("ERECTOR_MARKET_ANALYZE", {
      ...existingMarket,
      maxTokens: 2200,
      systemPrompt:
        ERECTOR_JSON_PREFIX +
        STANDARD_HEADER +
        `\nYou are supporting The Erector validation system. Analyze market demand and list 3-5 concrete opportunities with full summaries (max 100 words each).`,
      buildUserPrompt: (ctx) =>
        `${buildErectorFactsContext(ctx)}\n${envelope("erector_market", marketData, ctx["stateVersion"])}`,
    });
  }

  const existingEconomy = registry.get("ERECTOR_ECONOMY_BRIEFING");
  if (existingEconomy) {
    registry.set("ERECTOR_ECONOMY_BRIEFING", {
      ...existingEconomy,
      maxTokens: 2200,
      systemPrompt:
        ERECTOR_JSON_PREFIX +
        STANDARD_HEADER +
        `\nYou are supporting The Erector validation system. Produce a deep economy briefing with a complete economicContext object for the user's country.`,
      buildUserPrompt: (ctx) =>
        `${buildErectorFactsContext(ctx)}\n${envelope("erector_economy", economyData, ctx["stateVersion"])}`,
    });
  }
}
