import {
  db,
  bhudhiDomains,
  bhudhiFrameworks,
  bhudhiExecutionEvents,
  bhudhiSignals,
  blueprints,
} from "@workspace/db";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { DOMAIN_CATALOG } from "./domainCatalog.js";
import {
  getDomainConditions,
  getDomainDescription,
  resolveDomainFromEventCount,
} from "./domainLogic.js";
import type {
  BhudhiDomainName,
  DomainFrameworkView,
  DomainTransitionCheck,
  DomainTransitionResult,
} from "./types.js";
import { logger } from "../../lib/logger.js";

export class DomainsService {
  async initializeDomains(): Promise<number> {
    const now = new Date();
    for (const domain of DOMAIN_CATALOG) {
      await db
        .insert(bhudhiDomains)
        .values({
          id: domain.id,
          name: domain.name,
          description: domain.description,
          active_frameworks: domain.activeFrameworks,
          framework_roles: domain.frameworkRoles,
          settings: { initialized: true, prompt: 7 },
        })
        .onConflictDoUpdate({
          target: bhudhiDomains.id,
          set: {
            description: domain.description,
            active_frameworks: domain.activeFrameworks,
            framework_roles: domain.frameworkRoles,
            settings: { initialized: true, prompt: 7 },
            updated_at: now,
          },
        });
    }
    return DOMAIN_CATALOG.length;
  }

  async getCurrentDomain(blueprintId: string): Promise<BhudhiDomainName> {
    const [eventTotal] = await db
      .select({ total: count() })
      .from(bhudhiExecutionEvents)
      .where(eq(bhudhiExecutionEvents.blueprint_id, blueprintId));

    const totalEvents = Number(eventTotal?.total ?? 0);

    const [latestSignal] = await db
      .select({ global_signal: bhudhiSignals.global_signal })
      .from(bhudhiSignals)
      .where(eq(bhudhiSignals.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiSignals.created_at))
      .limit(1);

    const resolved = resolveDomainFromEventCount(
      totalEvents,
      latestSignal?.global_signal,
    );

    return resolved;
  }

  async getDomainConfig(domain: string) {
    const [row] = await db
      .select()
      .from(bhudhiDomains)
      .where(eq(bhudhiDomains.name, domain))
      .limit(1);
    return row ?? null;
  }

  async getFrameworksForDomain(domain: string): Promise<DomainFrameworkView[]> {
    const domainConfig = await this.getDomainConfig(domain);
    if (!domainConfig) return [];

    const activeNames = domainConfig.active_frameworks as string[];
    const roles = domainConfig.framework_roles as Record<string, string>;

    if (activeNames.length === 0) return [];

    const frameworks = await db
      .select()
      .from(bhudhiFrameworks)
      .where(and(inArray(bhudhiFrameworks.name, activeNames), eq(bhudhiFrameworks.status, "active")));

    return frameworks.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      description: f.description,
      accuracy: f.accuracy,
      role: (roles[f.name] ?? "advise") as DomainFrameworkView["role"],
    }));
  }

  async checkDomainTransition(
    blueprintId: string,
    currentDomain: string,
  ): Promise<DomainTransitionCheck> {
    const newDomain = await this.getCurrentDomain(blueprintId);
    return {
      transition: newDomain !== currentDomain,
      newDomain,
    };
  }

  async handleDomainTransition(
    blueprintId: string,
    fromDomain: string,
    toDomain: string,
  ): Promise<DomainTransitionResult | null> {
    const fromConfig = await this.getDomainConfig(fromDomain);
    const toConfig = await this.getDomainConfig(toDomain);
    if (!fromConfig || !toConfig) return null;

    logger.info({ blueprintId, fromDomain, toDomain }, "[Domains] transition");

    const newFrameworks = await this.getFrameworksForDomain(toDomain);

    await db.insert(bhudhiExecutionEvents).values({
      blueprint_id: blueprintId,
      event_type: "task_completed",
      description: `Domain transitioned from ${fromDomain} to ${toDomain}`,
      data: {
        transition: true,
        fromDomain,
        toDomain,
        newFrameworks: newFrameworks.map((f) => f.name),
      },
      learnings_generated: [
        "Domain transition indicates maturity progression",
        `New frameworks are now active: ${newFrameworks.map((f) => f.name).join(", ")}`,
      ],
      frameworks_improved: [],
    });

    await db
      .update(blueprints)
      .set({
        current_domain: toDomain as typeof blueprints.$inferInsert.current_domain,
        updated_at: new Date(),
      })
      .where(eq(blueprints.id, blueprintId));

    return {
      success: true,
      newDomain: toDomain as BhudhiDomainName,
      activeFrameworks: newFrameworks,
    };
  }

  getDomainDescription(domain: string): string {
    return getDomainDescription(domain);
  }

  getDomainConditions(domain: string) {
    return getDomainConditions(domain);
  }

  listDomains() {
    return DOMAIN_CATALOG.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      frameworkCount: d.activeFrameworks.length,
    }));
  }
}

export const domainsService = new DomainsService();
