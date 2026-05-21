/**
 * Safe entry points for other engines — respects gamification_enabled flag.
 */
import { checkFeatureFlag } from "../../lib/utils.js";
import { FEATURE_FLAGS } from "../../constants/feature-flags.js";
import { logger } from "../../lib/logger.js";
import { recordXpEvent, type XpEventInput } from "./GamificationEngine.js";

export async function tryAwardGamificationXp(input: XpEventInput) {
  try {
    const on = await checkFeatureFlag(FEATURE_FLAGS.GAMIFICATION_ENABLED);
    if (!on) return null;
    return await recordXpEvent(input);
  } catch (err) {
    logger.warn({ err, userId: input.userId, eventType: input.eventType }, "[Gamification] XP award skipped");
    return null;
  }
}
