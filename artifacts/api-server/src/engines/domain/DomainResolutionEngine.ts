import { db } from "@workspace/db";
import { blueprints, domainHistory } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import {
  DOMAINS,
  DOMAIN_PHASE1_STATUS,
  DEFAULT_DOMAIN,
  type Domain,
  type DomainPhase1Status,
} from "../../constants/domains.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

export type { Domain };

export type DomainTransitionTrigger =
  | "validation_complete"
  | "blueprint_launched"
  | "signal_change"
  | "condition_change"
  | "strategy_pivot"
  | "manual_review"
  | "phase_complete"
  | "recovery_mode";

export interface DomainTransitionResult {
  blueprintId:     string;
  fromDomain:      Domain | null;
  toDomain:        Domain;
  applied:         boolean;
  blockedBy?:      "phase1_disabled" | "noop";
  trigger:         DomainTransitionTrigger;
  notes?:          string;
}

export interface DomainTransitionEvaluation {
  shouldTransition: boolean;
  recommended:      Domain;
  rationale:        string;
}

/**
 * DomainResolutionEngine — Resolves the correct execution domain for a
 * blueprint based on goal content and Phase 1 activation rules, and handles
 * runtime transitions between domains.
 *
 * Phase 1 rules (DOMAIN_PHASE1_STATUS):
 *   genesis                              → always_active (default fallback)
 *   market, delivery, continuity         → active        (full execution)
 *   operations                           → limited       (allowed but constrained)
 *   growth, people                       → disabled      (blocked; redirect to genesis)
 *
 * Spec: Prompt 4 §DomainResolutionEngine.
 */
export class DomainResolutionEngine {
  // ── INITIAL RESOLUTION ────────────────────────────────────────────────────

  resolve(goal: string, hint: string | null): Domain {
    return this.resolveInitialDomain({ goal, domainHint: hint });
  }

  // Spec: `resolveInitialDomain(params)` — exposes the canonical name.
  resolveInitialDomain(params: { goal: string; domainHint?: string | null }): Domain {
    logger.debug({ hint: params.domainHint }, "DomainResolutionEngine.resolveInitialDomain");

    const raw = params.domainHint?.toLowerCase().trim() ?? null;
    if (raw && Object.values(DOMAINS).includes(raw as Domain)) {
      return this.enforcePhase1(raw as Domain);
    }
    return this.enforcePhase1(this.inferFromGoal(params.goal));
  }

  // ── RUNTIME TRANSITION ────────────────────────────────────────────────────

  // Spec: `transitionDomain(params)` — writes DomainHistory, blocks
  // disabled domains, updates blueprint.current_domain, emits state_changed.
  async transitionDomain(params: {
    blueprintId: string;
    userId:      string;
    toDomain:    Domain;
    trigger:     DomainTransitionTrigger;
    notes?:      string;
  }): Promise<DomainTransitionResult> {
    const { blueprintId, userId, toDomain, trigger, notes } = params;
    logger.info({ blueprintId, toDomain, trigger }, "DomainResolutionEngine.transitionDomain");

    if (this.getPhase1Status(toDomain) === "disabled") {
      logger.warn({ blueprintId, toDomain }, "[Domain] Transition blocked — domain disabled in Phase 1");
      return {
        blueprintId,
        fromDomain: null,
        toDomain,
        applied:    false,
        blockedBy:  "phase1_disabled",
        trigger,
        notes:      `Transition to ${toDomain} blocked by Phase 1 activation rules.`,
      };
    }

    const [bp] = await db
      .select({ current_domain: blueprints.current_domain })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);
    if (!bp) throw new TorgimaError("NOT_FOUND", "Blueprint not found");

    const fromDomain = (bp.current_domain ?? null) as Domain | null;
    if (fromDomain === toDomain) {
      return {
        blueprintId,
        fromDomain,
        toDomain,
        applied:   false,
        blockedBy: "noop",
        trigger,
        notes:     "Already in target domain.",
      };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(domainHistory)
        .set({ is_current: false, exited_at: now })
        .where(
          and(
            eq(domainHistory.blueprint_id, blueprintId),
            eq(domainHistory.is_current, true),
          ),
        );

      await tx.insert(domainHistory).values({
        blueprint_id:       blueprintId,
        user_id:            userId,
        domain:             toDomain,
        previous_domain:    fromDomain,
        transition_trigger: trigger,
        transition_notes:   notes ?? `Domain transition: ${fromDomain ?? "null"} → ${toDomain} (${trigger})`,
        is_current:         true,
        entered_at:         now,
      });

      await tx
        .update(blueprints)
        .set({ current_domain: toDomain })
        .where(eq(blueprints.id, blueprintId));
    });

    await writeEvent({
      eventType:  EVENT_TYPES.STATE_CHANGED,
      entityType: "blueprint",
      entityId:   blueprintId,
      userId,
      blueprintId,
      payload: {
        change_type:  "domain_transition",
        from_domain:  fromDomain,
        to_domain:    toDomain,
        trigger,
        notes:        notes ?? null,
      },
    }).catch(() => null);

    return { blueprintId, fromDomain, toDomain, applied: true, trigger, notes };
  }

  // Spec: `evaluateDomainTransition(params)` — diagnostic only, returns the
  // recommendation but does not write. Callers decide whether to apply.
  evaluateDomainTransition(params: {
    blueprintId:      string;
    currentDomain:    Domain | null;
    currentCondition: string | null;
    signalSummary?:   { momentum: number; trend: string };
    pivotInProgress?: boolean;
  }): DomainTransitionEvaluation {
    const { currentDomain, currentCondition, signalSummary, pivotInProgress } = params;

    if (pivotInProgress) {
      return {
        shouldTransition: false,
        recommended:      currentDomain ?? DEFAULT_DOMAIN,
        rationale:        "Pivot in progress; domain transitions are paused.",
      };
    }

    if (!currentDomain) {
      return {
        shouldTransition: true,
        recommended:      DEFAULT_DOMAIN,
        rationale:        "No domain set; defaulting to genesis.",
      };
    }

    if (currentCondition === "danger" || currentCondition === "urgency") {
      if (currentDomain !== DEFAULT_DOMAIN) {
        return {
          shouldTransition: true,
          recommended:      DEFAULT_DOMAIN,
          rationale:        `Condition ${currentCondition}: drop back to genesis until signal recovers.`,
        };
      }
    }

    if (signalSummary && signalSummary.momentum < 25 && currentDomain !== DEFAULT_DOMAIN) {
      return {
        shouldTransition: true,
        recommended:      DEFAULT_DOMAIN,
        rationale:        "Momentum below recovery threshold; recommend genesis fallback.",
      };
    }

    return {
      shouldTransition: false,
      recommended:      currentDomain,
      rationale:        "Current domain remains optimal.",
    };
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  getPhase1Status(domain: Domain): DomainPhase1Status {
    return DOMAIN_PHASE1_STATUS[domain] ?? "disabled";
  }

  enforcePhase1(domain: Domain): Domain {
    const status = this.getPhase1Status(domain);
    if (status === "disabled") {
      logger.info({ domain }, "[Domain] Phase 1 disabled; falling back to genesis");
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
