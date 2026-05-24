import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { GEMINI_SEARCH_TRIGGERS } from "./bhudhiProviders.js";

/** @deprecated Anthropic web_search tool removed — use Gemini `gemini-search` provider instead. */
export const WEB_SEARCH_ERECTOR_TRIGGERS = GEMINI_SEARCH_TRIGGERS;

/** @deprecated Use contract.provider === "gemini-search" in BhudhiCore. */
export function shouldUseWebSearch(triggerType: BhudhiTriggerType | string): boolean {
  return GEMINI_SEARCH_TRIGGERS.has(triggerType as BhudhiTriggerType);
}

const WEB_SEARCH_APPEND: Partial<Record<BhudhiTriggerType, string>> = {
  ERECTOR_INDUSTRY_ANALYZE: `
IMPORTANT: Use Google Search grounding to find current information about this industry before responding. Search for: current state of the industry in the user's country/region, recent growth trends, market health in the current year, and key players. Base your analysis on what you find, not on potentially outdated training data. If search results conflict with training data, prefer the search results.`,
  ERECTOR_MARKET_ANALYZE: `
IMPORTANT: Use Google Search grounding to find current market data before responding. Search for: current market size for the business model in the user's country, demand trends in the current year, recent funding or growth signals in this space. Cite what you find.`,
  ERECTOR_COMPETITORS_IDENTIFY: `
IMPORTANT: Use Google Search grounding to identify real, currently operating competitors in this space. Search for: top tools/platforms in the user's market this year, alternatives to the stated goal, and market leaders in this category. Return only real companies that exist today.`,
  ERECTOR_ECONOMY_BRIEFING: `
IMPORTANT: Use Google Search grounding for your economy briefing. Search for: current economic conditions in the user's country this year, business environment, payment infrastructure, and recent regulatory changes affecting the business type. Reflect what is happening now, not historical patterns alone.`,
};

export function appendWebSearchInstruction(
  triggerType: BhudhiTriggerType,
  systemPrompt: string,
): string {
  const extra = WEB_SEARCH_APPEND[triggerType];
  if (!extra) return systemPrompt;
  if (systemPrompt.includes("Google Search")) return systemPrompt;
  return `${systemPrompt.trim()}${extra}`;
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
