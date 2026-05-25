/**
 * Prompt 4 — Erector Bhudhi call catalog (registered in PromptRegistry + FallbackLibrary).
 * Rule engine owns scores; these calls enrich narrative and structured payloads only.
 *
 * Execution/timing synthesis is merged in ErectorIntelligenceBridge from industry output (no separate trigger).
 */
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import type { BhudhiProvider } from "./bhudhiProviders.js";

export const ERECTOR_BHUDHI_CALLS: Array<{
  callName: string;
  provider: BhudhiProvider;
  triggerType: BhudhiTriggerType;
  outputType: string;
  fallbackKey: string;
}> = [
  { callName: "resolve_archetype", provider: "gemini", triggerType: "ERECTOR_ARCHETYPE_NARRATIVE", outputType: "erector_archetype_narrative", fallbackKey: "fallback.erector_archetype_narrative" },
  { callName: "decompose_purpose", provider: "gemini", triggerType: "ERECTOR_PURPOSE_DECOMPOSE", outputType: "erector_purpose", fallbackKey: "fallback.erector_purpose" },
  { callName: "analyze_industry", provider: "gemini-search", triggerType: "ERECTOR_INDUSTRY_ANALYZE", outputType: "erector_industry", fallbackKey: "fallback.erector_industry" },
  { callName: "analyze_market", provider: "gemini-search", triggerType: "ERECTOR_MARKET_ANALYZE", outputType: "erector_market", fallbackKey: "fallback.erector_market" },
  { callName: "identify_competitors", provider: "gemini-search", triggerType: "ERECTOR_COMPETITORS_IDENTIFY", outputType: "erector_competitors", fallbackKey: "fallback.erector_competitors" },
  { callName: "generate_economy_briefing", provider: "gemini-search", triggerType: "ERECTOR_ECONOMY_BRIEFING", outputType: "erector_economy", fallbackKey: "fallback.erector_economy" },
  { callName: "pain_analyze", provider: "gemini", triggerType: "ERECTOR_PAIN_ANALYZE", outputType: "erector_pain", fallbackKey: "fallback.erector_pain" },
  { callName: "simulate_timeframes", provider: "gemini", triggerType: "ERECTOR_SIMULATE_TIMEFRAMES", outputType: "erector_time_simulation", fallbackKey: "fallback.erector_time_simulation" },
  { callName: "generate_paths", provider: "gemini", triggerType: "ERECTOR_PATHS_GENERATE", outputType: "erector_paths", fallbackKey: "fallback.erector_paths" },
  { callName: "generate_first_week", provider: "gemini", triggerType: "ERECTOR_FIRST_WEEK", outputType: "erector_first_week", fallbackKey: "fallback.erector_first_week" },
];
