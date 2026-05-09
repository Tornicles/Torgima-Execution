import { logger } from "../../lib/logger.js";
import {
  DOMAINS,
  DOMAIN_PHASE1_STATUS,
  DEFAULT_DOMAIN,
  type Domain,
  type DomainPhase1Status,
} from "../../constants/domains.js";

export { Domain };

/**
 * DomainResolutionEngine — Resolves the correct execution domain
 * for a blueprint based on goal content and Phase 1 activation rules.
 *
 * Phase 1 rules:
 *   genesis, market, delivery, continuity → fully active
 *   operations                            → limited (allowed but constrained)
 *   growth, people                        → disabled (redirect to genesis)
 */
export class DomainResolutionEngine {
  resolve(goal: string, hint: string | null): Domain {
    logger.debug({ hint }, "DomainResolutionEngine.resolve");

    const raw = hint?.toLowerCase().trim() ?? null;
    if (raw && Object.values(DOMAINS).includes(raw as Domain)) {
      return this.enforcePhase1(raw as Domain);
    }

    return this.enforcePhase1(this.inferFromGoal(goal));
  }

  getPhase1Status(domain: Domain): DomainPhase1Status {
    return DOMAIN_PHASE1_STATUS[domain] ?? "disabled";
  }

  enforcePhase1(domain: Domain): Domain {
    const status = this.getPhase1Status(domain);
    if (status === "disabled") {
      logger.info({ domain }, "DomainResolutionEngine: domain disabled in Phase 1, defaulting to genesis");
      return DEFAULT_DOMAIN;
    }
    return domain;
  }

  private inferFromGoal(goal: string): Domain {
    const g = goal.toLowerCase();

    if (/revenue|sales|customer|client|b2b|saas|mrr|arr|churn|price|monetize/i.test(g)) {
      return DOMAINS.MARKET;
    }
    if (/ship|launch|deploy|deliver|build|product|feature|release|code|app|mvp/i.test(g)) {
      return DOMAINS.DELIVERY;
    }
    if (/habit|daily|routine|consistent|streak|morning|practice|discipline/i.test(g)) {
      return DOMAINS.CONTINUITY;
    }
    if (/team|hire|people|culture|hr|talent|manager|recruit/i.test(g)) {
      return DOMAINS.PEOPLE;
    }
    if (/grow|scale|expand|10x|double|triple|traffic|audience|user base/i.test(g)) {
      return DOMAINS.GROWTH;
    }
    if (/process|ops|operations|system|automate|workflow|efficiency/i.test(g)) {
      return DOMAINS.OPERATIONS;
    }

    return DOMAINS.GENESIS;
  }
}
