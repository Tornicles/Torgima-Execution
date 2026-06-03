import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { BHUDHI_MODEL } from "../lib/anthropic.js";
import { logger } from "../lib/logger.js";

/** Anthropic Claude is the sole Bhudhi model provider. */
export type BhudhiProvider = "claude";

/** Erector / validation triggers that receive market-research prompt enrichment (Claude only). */
export const ERECTOR_SEARCH_TRIGGERS = new Set<BhudhiTriggerType>([
  "ERECTOR_INDUSTRY_ANALYZE",
  "ERECTOR_MARKET_ANALYZE",
  "ERECTOR_COMPETITORS_IDENTIFY",
  "ERECTOR_ECONOMY_BRIEFING",
  "VALIDATE_STAGE_4_PATTERNS",
  "VALIDATE_STAGE_5_TIMING",
  "VALIDATE_STAGE_6_MARKET",
  "VALIDATE_STAGE_7_CHANNELS",
  "VALIDATION_RESEARCH_MARKET",
  "VALIDATION_RESEARCH_COMPETITORS",
  "VALIDATION_COMPETITOR_DEEP_ANALYSIS",
  "VALIDATION_ANALYZE_DEMAND",
]);

/** @deprecated Use ERECTOR_SEARCH_TRIGGERS */
export const GEMINI_SEARCH_TRIGGERS = ERECTOR_SEARCH_TRIGGERS;

/** @deprecated All triggers use Claude */
export const GEMINI_STANDARD_TRIGGERS = new Set<BhudhiTriggerType>();

export function providerForTrigger(_triggerType: BhudhiTriggerType | string): BhudhiProvider {
  return "claude";
}

export function modelIdForProvider(_provider: BhudhiProvider): string {
  return BHUDHI_MODEL;
}

export function logBhudhiProviderRouting(): void {
  logger.info(
    { model: BHUDHI_MODEL, erectorTriggers: [...ERECTOR_SEARCH_TRIGGERS] },
    "[Bhudhi] Provider routing: Anthropic Claude only",
  );
}
