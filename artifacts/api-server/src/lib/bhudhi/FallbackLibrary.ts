import type { Doc12TriggerType } from "./TriggerRegistry.js";
import { FallbackLibrary as Doc13FallbackLibrary } from "./fallbacks/FallbackLibrary.js";
import type { BhudhiOutputEnvelope } from "../../types/bhudhi.js";

/** DOC12 router fallback — delegates to DOC13 schema-validated deterministic fallbacks. */
export function getFallbackForTrigger(
  triggerType: Doc12TriggerType,
  ctx: Record<string, unknown>,
  stateVersion: number,
): BhudhiOutputEnvelope {
  return Doc13FallbackLibrary.getEnvelope(triggerType, stateVersion, ctx);
}

export const FallbackLibrary = {
  get: getFallbackForTrigger,
};

export { FallbackLibrary as Doc13FallbackLibrary } from "./fallbacks/FallbackLibrary.js";
