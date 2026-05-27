import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { ERECTOR_SEARCH_TRIGGERS } from "./bhudhiProviders.js";

/** Erector triggers that receive market-research prompt enrichment (Claude). */
export const WEB_SEARCH_ERECTOR_TRIGGERS = ERECTOR_SEARCH_TRIGGERS;

/** Prepended to every Erector Bhudhi system prompt. */
export const ERECTOR_JSON_PREFIX = `You are Bhudhi, a precision intelligence system. CRITICAL: Your response must be valid JSON only. No markdown. No code fences. No prose before or after. Return ONLY the JSON object described below. If you cannot determine a value, use null — never omit a field.

`;

export const COMPETITOR_AUTHENTICITY_RULE = `
AUTHENTICITY RULE: Only return competitors that you can verify exist through your search results. If a competitor name comes from your training data but you cannot find current evidence it still operates, mark it with archetypeContext: 'unverified — confirm independently'. Never invent a company name. Never assume a company still exists without search confirmation.`;

export function shouldUseWebSearch(triggerType: BhudhiTriggerType | string): boolean {
  return ERECTOR_SEARCH_TRIGGERS.has(triggerType as BhudhiTriggerType);
}

const WEB_SEARCH_SYSTEM_APPEND: Partial<Record<BhudhiTriggerType, string>> = {
  ERECTOR_INDUSTRY_ANALYZE: `
IMPORTANT: Use Google Search grounding to find current information about this industry before responding.`,
  ERECTOR_MARKET_ANALYZE: `
IMPORTANT: Use Google Search grounding to find current market data before responding.`,
  ERECTOR_COMPETITORS_IDENTIFY: `
IMPORTANT: Use Google Search grounding to identify real, currently operating competitors in this space.`,
  ERECTOR_ECONOMY_BRIEFING: `
IMPORTANT: Use Google Search grounding for your economy briefing.`,
};

export function appendWebSearchInstruction(
  triggerType: BhudhiTriggerType,
  systemPrompt: string,
): string {
  let out = systemPrompt;
  const extra = WEB_SEARCH_SYSTEM_APPEND[triggerType];
  if (extra && !systemPrompt.includes("Google Search")) {
    out = `${out.trim()}${extra}`;
  }
  if (triggerType === "ERECTOR_COMPETITORS_IDENTIFY" && !out.includes("AUTHENTICITY RULE")) {
    out = `${out.trim()}${COMPETITOR_AUTHENTICITY_RULE}`;
  }
  return out;
}

function erectorInputFields(ctx: Record<string, unknown>) {
  const location = (ctx.location as { country?: string } | undefined) ?? {};
  const country = String(location.country ?? ctx.locationCountry ?? ctx.country ?? "the user's country");
  const rawGoal = String(ctx.rawGoal ?? ctx.goal ?? "");
  const businessModel = String(ctx.businessModel ?? "");
  const businessType = String(ctx.businessType ?? "online");
  const targetCustomer = String(ctx.targetCustomer ?? "this audience");
  const year = new Date().getFullYear();
  return { country, rawGoal, businessModel, businessType, targetCustomer, year };
}

export function buildErectorDateContext(): string {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Today's date: ${today}.\nSearch for information that is current as of today.\n\n`;
}

function searchInstructionForTrigger(
  triggerType: BhudhiTriggerType,
  ctx: Record<string, unknown>,
): string {
  const { country, rawGoal, businessModel, businessType, targetCustomer, year } = erectorInputFields(ctx);
  const goalSnippet = rawGoal.split(/\s+/).slice(0, 6).join(" ");
  const goalSnippet5 = rawGoal.split(/\s+/).slice(0, 5).join(" ");

  switch (triggerType) {
    case "ERECTOR_INDUSTRY_ANALYZE":
      return `
SEARCH REQUIREMENT: Before responding, use Google Search to find:
1. Current state of this industry in ${country} in ${year}
2. Recent growth trends and market health for this industry
3. New entrants or major shifts in this space in the last 6 months
4. Any regulatory changes affecting this industry recently
Base your industry_state, health, and trend fields on what you find today, not on training data alone. If search results conflict with training data, prefer the current search results. State clearly what time period your analysis reflects.`;

    case "ERECTOR_MARKET_ANALYZE":
      return `
SEARCH REQUIREMENT: Before responding, use Google Search to find:
1. Current demand signals for ${businessModel} businesses in ${country}
2. What people are searching for related to: ${goalSnippet}
3. Recent reports on market size and growth for this type of business (${year})
4. Consumer behaviour trends in ${country} relevant to this market
Your market_score and all layer scores must reflect current conditions. If the market has shifted recently, that shift must be reflected in the output.`;

    case "ERECTOR_COMPETITORS_IDENTIFY":
      return `
SEARCH REQUIREMENT: Before responding, use Google Search to find:
1. Companies or creators currently operating in this space in ${country}
2. Search: top ${businessModel} tools for ${targetCustomer} ${year}
3. Search: ${goalSnippet5} alternatives competitors
4. Any new competitors that emerged in the last 12 months
Return ONLY real companies or creators that exist and are operating today. Do not invent competitors. If you cannot find 5 real ones, return fewer with strategicGapForUser noting 'limited competition found — this may be an open space or a very early market.'`;

    case "ERECTOR_ECONOMY_BRIEFING":
      return `
SEARCH REQUIREMENT: Before responding, use Google Search to find:
1. Current economic conditions in ${country} (${year})
2. Ease of doing ${businessType} business in ${country} right now
3. Payment infrastructure availability in ${country} for ${businessModel}
4. Any recent economic events in ${country} affecting small businesses
5. Consumer purchasing behaviour in ${country} for ${businessModel} products
Your briefing must reflect what is actually happening in this economy TODAY. Include specific current context — not generic historical patterns. If there are active economic challenges (inflation, currency issues, regulatory changes), these must appear in economySpecificWarnings.`;

    default:
      return "";
  }
}

/** Appends date context + research instructions to Erector user prompts. */
export function appendErectorSearchUserPrompt(
  triggerType: BhudhiTriggerType,
  ctx: Record<string, unknown>,
  userPrompt: string,
): string {
  if (!ERECTOR_SEARCH_TRIGGERS.has(triggerType)) return userPrompt;
  const searchBlock = searchInstructionForTrigger(triggerType, ctx);
  if (!searchBlock.trim()) return userPrompt;
  return `${buildErectorDateContext()}${userPrompt.trim()}${searchBlock}`;
}

export function buildErectorFactsContext(facts: Record<string, unknown>): string {
  const year = new Date().getFullYear();
  const location =
    (facts.location as { country?: string; city?: string } | undefined) ??
    (facts.locationCountry ? { country: facts.locationCountry, city: facts.locationCity } : {});
  return [
    `Goal: ${String(facts.goal ?? facts.rawGoal ?? "")}`,
    `Purpose: ${String(facts.purpose ?? "")}`,
    `Target customer: ${String(facts.targetCustomer ?? "")}`,
    `Business model: ${String(facts.businessModel ?? "")}`,
    `Business type: ${String(facts.businessType ?? "online")}`,
    `Country: ${String(location.country ?? facts.locationCountry ?? "")}`,
    `City: ${String(location.city ?? facts.locationCity ?? "")}`,
    `Timeframe: ${String(facts.timeframe ?? "")}`,
    `Budget available: ${String(facts.budgetAvailable ?? "")}`,
    `Currency: ${String(facts.currency ?? "USD")}`,
    `Current year for search grounding: ${year}`,
    `Archetype profile: ${JSON.stringify(facts.archetype ?? facts.primaryArchetype ?? {})}`,
    `Prior engine outputs: ${JSON.stringify(facts.priorOutputs ?? {})}`,
  ].join("\n");
}
