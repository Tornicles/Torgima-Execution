/**
 * Erector Bhudhi call catalog — all routes use Anthropic Claude via TriggerRouter.
 */
import type { BhudhiProvider } from "./bhudhiProviders.js";

export type ErectorBhudhiCall = {
  callName: string;
  provider: BhudhiProvider;
  triggerType: string;
  outputType: string;
  fallbackKey: string;
};

export const ERECTOR_BHUDHI_CALLS: ErectorBhudhiCall[] = [
  { callName: "resolve_archetype", provider: "claude", triggerType: "ERECTOR_ARCHETYPE_NARRATIVE", outputType: "erector_archetype_narrative", fallbackKey: "fallback.erector_archetype_narrative" },
  { callName: "decompose_purpose", provider: "claude", triggerType: "ERECTOR_PURPOSE_DECOMPOSE", outputType: "erector_purpose", fallbackKey: "fallback.erector_purpose" },
  { callName: "analyze_industry", provider: "claude", triggerType: "ERECTOR_INDUSTRY_ANALYZE", outputType: "erector_industry", fallbackKey: "fallback.erector_industry" },
  { callName: "analyze_market", provider: "claude", triggerType: "ERECTOR_MARKET_ANALYZE", outputType: "erector_market", fallbackKey: "fallback.erector_market" },
  { callName: "identify_competitors", provider: "claude", triggerType: "ERECTOR_COMPETITORS_IDENTIFY", outputType: "erector_competitors", fallbackKey: "fallback.erector_competitors" },
  { callName: "generate_economy_briefing", provider: "claude", triggerType: "ERECTOR_ECONOMY_BRIEFING", outputType: "erector_economy", fallbackKey: "fallback.erector_economy" },
  { callName: "pain_analyze", provider: "claude", triggerType: "ERECTOR_PAIN_ANALYZE", outputType: "erector_pain", fallbackKey: "fallback.erector_pain" },
  { callName: "simulate_timeframes", provider: "claude", triggerType: "ERECTOR_SIMULATE_TIMEFRAMES", outputType: "erector_time_simulation", fallbackKey: "fallback.erector_time_simulation" },
  { callName: "generate_paths", provider: "claude", triggerType: "ERECTOR_PATHS_GENERATE", outputType: "erector_paths", fallbackKey: "fallback.erector_paths" },
  { callName: "generate_first_week", provider: "claude", triggerType: "ERECTOR_FIRST_WEEK", outputType: "erector_first_week", fallbackKey: "fallback.erector_first_week" },
];
