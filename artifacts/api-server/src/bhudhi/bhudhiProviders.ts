import type { BhudhiTriggerType } from "../types/bhudhi.js";

export type BhudhiProvider = "claude" | "gemini" | "gemini-search";

/** Standard Gemini — no Google Search grounding. */
export const GEMINI_STANDARD_TRIGGERS = new Set<BhudhiTriggerType>([
  "ERECTOR_ARCHETYPE_NARRATIVE",
  "ERECTOR_PURPOSE_DECOMPOSE",
  "ERECTOR_PAIN_ANALYZE",
  "ERECTOR_SIMULATE_TIMEFRAMES",
  "ERECTOR_PATHS_GENERATE",
  "ERECTOR_FIRST_WEEK",
]);

/** Gemini + native Google Search grounding. */
export const GEMINI_SEARCH_TRIGGERS = new Set<BhudhiTriggerType>([
  "ERECTOR_INDUSTRY_ANALYZE",
  "ERECTOR_MARKET_ANALYZE",
  "ERECTOR_COMPETITORS_IDENTIFY",
  "ERECTOR_ECONOMY_BRIEFING",
]);

export function providerForTrigger(triggerType: BhudhiTriggerType | string): BhudhiProvider {
  const t = triggerType as BhudhiTriggerType;
  if (GEMINI_SEARCH_TRIGGERS.has(t)) return "gemini-search";
  if (GEMINI_STANDARD_TRIGGERS.has(t)) return "gemini";
  return "claude";
}

export function modelIdForProvider(provider: BhudhiProvider): string {
  if (provider === "claude") {
    return process.env.BHUDHI_MODEL ?? "claude-sonnet-4-20250514";
  }
  return process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
}

export function logBhudhiProviderRouting(): void {
  console.log("[Bhudhi] Provider routing:");
  console.log(
    "  Gemini (standard):      resolve_archetype, decompose_purpose, simulate_timeframes, generate_paths, generate_first_week, analyze_execution_and_timing, pain_analyze",
  );
  console.log(
    "  Gemini + Google Search: analyze_industry, analyze_market, identify_competitors, generate_economy_briefing",
  );
  console.log("  Claude:                 all execution calls (task gen, blueprint, signals, feedback)");
}
