/**
 * BHUDHI_UPGRADE_PROMPT 2 — domain profiles + resolution.
 */
import { db, blueprints, domainHistory } from "@workspace/db";
import { eq } from "drizzle-orm";
import { routeBhudhiRequest } from "./TriggerRouter.js";
import { logger } from "../lib/logger.js";

export type ExecutionDomain =
  | "GENESIS"
  | "MARKET"
  | "DELIVERY"
  | "OPERATIONS"
  | "GROWTH"
  | "CONTINUITY"
  | "PEOPLE";

export interface DomainProfile {
  focus: string;
  taskStyle: string;
  forbidden: string;
}

const PROFILES: Record<ExecutionDomain, DomainProfile> = {
  GENESIS: {
    focus: "Clarity + direction validity",
    taskStyle: "Decision/input tasks only",
    forbidden: "execution tasks",
  },
  MARKET: {
    focus: "Demand proof + positioning",
    taskStyle: "Test, analyze, validate demand",
    forbidden: "building tasks",
  },
  DELIVERY: {
    focus: "Execution + output quality",
    taskStyle: "Build, create, deliver, complete",
    forbidden: "strategy tasks",
  },
  OPERATIONS: {
    focus: "Systems + consistency",
    taskStyle: "Document, optimize, systematize",
    forbidden: "scaling tasks",
  },
  GROWTH: {
    focus: "Scaling + expansion",
    taskStyle: "Launch, expand, acquire, distribute",
    forbidden: "stabilization tasks",
  },
  CONTINUITY: {
    focus: "Recovery + risk control",
    taskStyle: "Protect, restore, audit, contingency",
    forbidden: "growth tasks",
  },
  PEOPLE: {
    focus: "Capability + team structure",
    taskStyle: "Hire, develop, delegate, structure",
    forbidden: "operations tasks",
  },
};

function normalizeDomain(raw: string | null | undefined): ExecutionDomain {
  const u = (raw ?? "GENESIS").toUpperCase();
  if (u in PROFILES) return u as ExecutionDomain;
  const map: Record<string, ExecutionDomain> = {
    genesis: "GENESIS",
    market: "MARKET",
    delivery: "DELIVERY",
    operations: "OPERATIONS",
    growth: "GROWTH",
    continuity: "CONTINUITY",
    people: "PEOPLE",
  };
  return map[(raw ?? "genesis").toLowerCase()] ?? "GENESIS";
}

export const DomainIntelligenceService = {
  getDomainProfile(domain: string): DomainProfile & { domain: ExecutionDomain } {
    const d = normalizeDomain(domain);
    return { domain: d, ...PROFILES[d] };
  },

  async resolveDomain(params: {
    userId: string;
    blueprintId: string;
    goalText: string;
    purposeText?: string;
    validationSummary?: Record<string, unknown>;
    stateVersion?: number;
  }): Promise<{ domain: ExecutionDomain; confidence: number; reasoning: string }> {
    const result = await routeBhudhiRequest<{
      domain?: string;
      confidence?: number;
      reasoning?: string;
    }>({
      sourceEngine: "BLUEPRINT_ENGINE",
      triggerType: "DOMAIN_RESOLUTION",
      userId: params.userId,
      blueprintId: params.blueprintId,
      stateVersion: params.stateVersion ?? 0,
      requestedMode: "STRUCTURE",
      idempotencyKey: `domain:${params.blueprintId}:${Date.now()}`,
      facts: {
        goal: params.goalText,
        purpose: params.purposeText,
        validation: params.validationSummary,
      },
    });

    const data = result.ok && result.output?.data ? result.output.data : null;
    const domain = normalizeDomain(
      typeof data?.domain === "string" ? data.domain : undefined,
    );
    return {
      domain,
      confidence: typeof data?.confidence === "number" ? data.confidence : 0.5,
      reasoning:
        typeof data?.reasoning === "string"
          ? data.reasoning
          : "Domain resolved via Bhudhi or fallback",
    };
  },

  async recordDomainTransition(params: {
    blueprintId: string;
    userId: string;
    fromDomain: string | null;
    toDomain: string;
    reason: string;
  }): Promise<void> {
    const to = params.toDomain.toLowerCase() as typeof domainHistory.$inferInsert.domain;
    const from = params.fromDomain
      ? (params.fromDomain.toLowerCase() as typeof domainHistory.$inferInsert.previous_domain)
      : null;
    await db.insert(domainHistory).values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      domain: to,
      previous_domain: from,
      transition_trigger: "blueprint_launched",
      transition_notes: params.reason.slice(0, 500),
      is_current: true,
    });
  },

  async applyDomainOnLaunch(params: {
    blueprintId: string;
    userId: string;
    goalText: string;
    purposeText?: string;
    validationSummary?: Record<string, unknown>;
    stateVersion?: number;
  }): Promise<ExecutionDomain> {
    const [bp] = await db
      .select({ current_domain: blueprints.current_domain })
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);

    if (bp?.current_domain) {
      return normalizeDomain(bp.current_domain);
    }

    const resolved = await this.resolveDomain(params);
    const domainLower = resolved.domain.toLowerCase() as typeof blueprints.$inferInsert.current_domain;
    await db
      .update(blueprints)
      .set({ current_domain: domainLower })
      .where(eq(blueprints.id, params.blueprintId));

    await this.recordDomainTransition({
      blueprintId: params.blueprintId,
      userId: params.userId,
      fromDomain: null,
      toDomain: resolved.domain,
      reason: resolved.reasoning,
    }).catch((err) => {
      logger.warn({ err }, "[DomainIntelligence] domain_history write failed");
    });

    return resolved.domain;
  },
};
