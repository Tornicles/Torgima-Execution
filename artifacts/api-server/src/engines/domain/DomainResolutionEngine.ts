import { logger } from "../../lib/logger.js";
import { DOMAINS, type Domain } from "../../constants/domains.js";

/**
 * DomainResolutionEngine — Resolves the correct execution domain
 * for a blueprint based on goal content, user history, and system state.
 *
 * TODO (Prompt 4): Implement full domain resolution with Bhudhi
 */
export class DomainResolutionEngine {
  resolve(rawGoal: string, hint: string | null): Domain {
    logger.info({ rawGoal }, "DomainResolutionEngine.resolve — TODO");
    if (hint && Object.values(DOMAINS).includes(hint as Domain)) {
      return hint as Domain;
    }
    // Naive keyword resolution — replace with Bhudhi in Prompt 4
    if (/revenue|sales|customer|market/i.test(rawGoal)) return DOMAINS.MARKET;
    if (/habit|daily|routine|consistent/i.test(rawGoal)) return DOMAINS.CONTINUITY;
    if (/skill|learn|capability|master/i.test(rawGoal)) return DOMAINS.CAPABILITY;
    if (/identity|who i am|become/i.test(rawGoal)) return DOMAINS.IDENTITY;
    if (/ship|launch|deliver|build/i.test(rawGoal)) return DOMAINS.DELIVERY;
    return DOMAINS.GENESIS;
  }
}
