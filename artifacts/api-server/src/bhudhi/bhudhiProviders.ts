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
  "ERECTOR_GOAL_REFINE",
  "ERECTOR_PURPOSE_REFINE",
  "VALIDATE_STAGE_2_DECOMPOSITION",
  "VALIDATE_STAGE_3_ECONOMIC",
  "VALIDATE_STAGE_8_PROS",
  "VALIDATE_STAGE_9_CONS",
  "VALIDATE_STAGE_10_FEASIBILITY",
  "VALIDATE_STAGE_11_VIABILITY",
  "VALIDATE_STAGE_12_BOOTSTRAP",
  "VALIDATE_STAGE_13_FEATURES",
  "VALIDATE_STAGE_14_CUSTOMER",
  "VALIDATE_STAGE_15_POSITIONING",
  "VALIDATE_STAGE_16_DIFFICULTY",
  "VALIDATE_STAGE_17_REVENUE",
  "VALIDATE_STAGE_18_90DAYS",
  "VALIDATE_STAGE_19_PATHS",
  "VALIDATE_STAGE_20_DECISION",
]);

/** Gemini + native Google Search grounding. */
export const GEMINI_SEARCH_TRIGGERS = new Set<BhudhiTriggerType>([
  "ERECTOR_INDUSTRY_ANALYZE",
  "ERECTOR_MARKET_ANALYZE",
  "ERECTOR_COMPETITORS_IDENTIFY",
  "ERECTOR_ECONOMY_BRIEFING",
  "VALIDATE_STAGE_4_PATTERNS",
  "VALIDATE_STAGE_5_TIMING",
  "VALIDATE_STAGE_6_MARKET",
  "VALIDATE_STAGE_7_CHANNELS",
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
