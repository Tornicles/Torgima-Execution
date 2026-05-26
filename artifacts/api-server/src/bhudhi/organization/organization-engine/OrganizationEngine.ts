import { randomUUID } from "node:crypto";
import { organizationPolicy } from "../policy/OrganizationPolicy.js";
import { organizationGraph } from "../org-graph/OrganizationGraph.js";
import { authorityEngine } from "../authority/AuthorityEngine.js";
import { departmentEngine } from "../departments/DepartmentEngine.js";
import { cultureEngine } from "../culture/CultureEngine.js";
import { strategyEngine } from "../strategy/StrategyEngine.js";
import { executionCoordinator } from "../execution/ExecutionCoordinator.js";
import { teamSync } from "../coordination/TeamSync.js";
import { organizationHealthEngine } from "../health/OrganizationHealth.js";
import { organizationMemory } from "../organization-memory/OrganizationMemory.js";
import { persistOrganization, listOrganizationHistory } from "../organizationData.js";
import type { AlignmentResult, CapacityResult, OrgInput, OrgOutput } from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BOOS — collective intelligence layer. Organization is a first-class entity.
 */
export class OrganizationEngine {
  async process(input: OrgInput): Promise<OrgOutput> {
    const sessionId = randomUUID();
    const organizationId = input.organizationId ?? randomUUID();
    const name = input.name ?? "Blueprint Organization";

    const policy = organizationPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Organization policy violation: ${policy.violations.join("; ")}`);
    }

    if (strategyEngine.blocksExecution(input)) {
      throw new Error("Execution without strategy is blocked — define vision first");
    }

    const roles = authorityEngine.assignFromInput(input);
    const graph = organizationGraph.build(input, organizationId, name);
    const culture = cultureEngine.measure(input);
    const strategy = strategyEngine.map(input);
    const coordination = executionCoordinator.coordinate(input);
    const sync = teamSync.detect(input);
    const departments = departmentEngine.assess(input);
    const health = organizationHealthEngine.score(input, culture, strategy);

    const projectCount = (input.projects ?? []).length;
    const userCount = Math.max(1, (input.users ?? []).length);
    const capacity: CapacityResult = {
      total: userCount * 5,
      allocated: projectCount * 2,
      available: Math.max(0, userCount * 5 - projectCount * 2),
      utilization: projectCount > 0 ? Math.min(1, (projectCount * 2) / (userCount * 5)) : 0,
    };

    const alignment: AlignmentResult = {
      score: strategy.alignment,
      gaps: strategy.recommendations,
      recommendations: [
        ...strategy.recommendations,
        ...sync.actions.map((a) => `Team sync: ${a}`),
        health.action !== "none" ? `Health: ${health.action}` : "",
      ].filter(Boolean),
    };

    const organizationState = {
      organizationId,
      name,
      nodeCount: graph.nodes.length,
      ownerId: roles.find((r) => r.authority === "OWNER")?.userId,
    };

    const output: OrgOutput = {
      sessionId,
      organizationState,
      capacity,
      health,
      alignment,
      graph,
      culture,
      strategy,
      coordination,
      teamSync: sync,
    };

    organizationMemory.store(input.blueprintId, output);

    try {
      await persistOrganization(output, { blueprintId: input.blueprintId }, roles);
      void departments;
    } catch (err) {
      logger.warn({ err, sessionId }, "[OrganizationEngine] persist skipped");
    }

    return output;
  }

  formatOrganizationContext(output: OrgOutput): string {
    return [
      `Org: ${output.organizationState.name} (health ${output.health.score}/100)`,
      `Alignment: ${Math.round(output.alignment.score * 100)}%`,
      `Capacity: ${Math.round(output.capacity.utilization * 100)}% utilized`,
      `Culture: ${output.culture?.profile ?? "n/a"}`,
      output.coordination?.blocked.length
        ? `Blocked: ${output.coordination.blocked.join(", ")}`
        : "",
      output.teamSync?.issues.length ? `Sync issues: ${output.teamSync.issues.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async create(input: OrgInput): Promise<OrgOutput> {
    return this.process(input);
  }

  async health(blueprintId: string, input?: Partial<OrgInput>) {
    const cached = organizationMemory.get(blueprintId);
    if (cached) return cached.health;
    const full = await this.process({ blueprintId, ...input });
    return full.health;
  }

  async align(blueprintId: string, input?: Partial<OrgInput>) {
    const cached = organizationMemory.get(blueprintId);
    if (cached) return cached.alignment;
    const full = await this.process({ blueprintId, ...input });
    return full.alignment;
  }

  async coordinate(blueprintId: string, input?: Partial<OrgInput>) {
    const cached = organizationMemory.get(blueprintId);
    if (cached?.coordination) return cached.coordination;
    const full = await this.process({ blueprintId, ...input });
    return full.coordination;
  }

  async syncTeams(blueprintId: string, input?: Partial<OrgInput>) {
    const cached = organizationMemory.get(blueprintId);
    if (cached?.teamSync) return cached.teamSync;
    return teamSync.detect({ blueprintId, ...input });
  }

  async history(blueprintId: string, limit?: number) {
    return listOrganizationHistory(blueprintId, limit);
  }
}

export const organizationEngine = new OrganizationEngine();
