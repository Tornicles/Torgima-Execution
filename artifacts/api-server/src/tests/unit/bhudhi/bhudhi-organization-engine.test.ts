import { emptyDbQueryResult } from "../../helpers/bhudhiDbMock.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { organizationGraph } from "../../../bhudhi/organization/org-graph/OrganizationGraph.js";
import { authorityEngine } from "../../../bhudhi/organization/authority/AuthorityEngine.js";
import { departmentEngine } from "../../../bhudhi/organization/departments/DepartmentEngine.js";
import { cultureEngine } from "../../../bhudhi/organization/culture/CultureEngine.js";
import { strategyEngine } from "../../../bhudhi/organization/strategy/StrategyEngine.js";
import { executionCoordinator } from "../../../bhudhi/organization/execution/ExecutionCoordinator.js";
import { teamSync } from "../../../bhudhi/organization/coordination/TeamSync.js";
import { organizationHealthEngine } from "../../../bhudhi/organization/health/OrganizationHealth.js";
import { organizationPolicy } from "../../../bhudhi/organization/policy/OrganizationPolicy.js";

vi.mock("@workspace/db", () => {
  function emptyDbQueryResult(): Promise<unknown[]> & {
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  } {
    const promise = Promise.resolve([]) as unknown as Promise<unknown[]> & {
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    };
    promise.orderBy = vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) }));
    promise.limit = vi.fn().mockResolvedValue([]);
    return promise;
  }

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => emptyDbQueryResult()),
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
    },
    bhudhiOrganizations: {},
    bhudhiOrganizationRoles: {},
    bhudhiOrganizationHealth: {},
    bhudhiOrganizationEvents: {},
    bhudhiOrganizationMemory: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-000000000004",
  name: "Torgima Squad",
  strategy: { vision: "Ship intelligence OS", priorities: ["execution", "governance"] },
  users: [
    { userId: "00000000-0000-4000-8000-000000000001", role: "OWNER", department: "strategy" as const },
    { userId: "00000000-0000-4000-8000-000000000002", role: "LEAD", department: "engineering" as const },
  ],
  projects: [
    { id: "p1", name: "BOOS", ownerId: "00000000-0000-4000-8000-000000000001", status: "active" },
  ],
  signals: { global: "power", confidence: 0.8 },
};

describe("BOOS — OrganizationGraph", () => {
  it("builds connected org graph — no isolated actors", () => {
    const { nodes, edges } = organizationGraph.build(baseInput, "org-1", "Torgima Squad");
    expect(nodes.length).toBeGreaterThanOrEqual(5);
    expect(edges.length).toBeGreaterThan(0);
    expect(nodes.some((n) => n.kind === "organization")).toBe(true);
  });
});

describe("BOOS — AuthorityEngine", () => {
  it("assigns explicit authority levels and permissions", () => {
    const roles = authorityEngine.assignFromInput(baseInput);
    expect(roles.some((r) => r.authority === "OWNER")).toBe(true);
    expect(authorityEngine.can("MEMBER", "execute")).toBe(true);
    expect(authorityEngine.can("OBSERVER", "execute")).toBe(false);
  });
});

describe("BOOS — StrategyEngine", () => {
  it("blocks execution without strategy when projects exist", () => {
    expect(
      strategyEngine.blocksExecution({
        blueprintId: baseInput.blueprintId,
        projects: [{ id: "x", name: "X" }],
      }),
    ).toBe(true);
  });

  it("maps alignment with vision", () => {
    const s = strategyEngine.map(baseInput);
    expect(s.hasVision).toBe(true);
    expect(s.alignment).toBeGreaterThan(0.5);
  });
});

describe("BOOS — CultureEngine", () => {
  it("measures culture profile", () => {
    const c = cultureEngine.measure(baseInput);
    expect(c.trust).toBeGreaterThan(0);
    expect(c.profile).toBeTruthy();
  });
});

describe("BOOS — ExecutionCoordinator", () => {
  it("coordinates owners and blocked items", () => {
    const coord = executionCoordinator.coordinate({
      blueprintId: baseInput.blueprintId,
      projects: [
        { id: "a", name: "Owned", ownerId: "00000000-0000-4000-8000-000000000001" },
        { id: "b", name: "Unowned" },
      ],
    });
    expect(coord.owners.length).toBe(1);
    expect(coord.blocked).toContain("Unowned");
  });
});

describe("BOOS — TeamSync", () => {
  it("detects sync issues", () => {
    const sync = teamSync.detect({
      blueprintId: baseInput.blueprintId,
      projects: [
        { id: "1", name: "Alpha" },
        { id: "2", name: "Alpha" },
      ],
    });
    expect(sync.issues.length).toBeGreaterThan(0);
  });
});

describe("BOOS — OrganizationHealth", () => {
  it("scores 0-100 with action", () => {
    const culture = cultureEngine.measure(baseInput);
    const strategy = strategyEngine.map(baseInput);
    const health = organizationHealthEngine.score(baseInput, culture, strategy);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
  });
});

describe("BOOS — OrganizationPolicy", () => {
  it("forbids invent authority and governance override", () => {
    const result = organizationPolicy.validate({
      blueprintId: baseInput.blueprintId,
      constraints: ["INVENT_AUTHORITY", "OVERRIDE_GOVERNANCE"],
    });
    expect(result.allowed).toBe(false);
  });
});

describe("BOOS — OrganizationEngine integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("process returns organization state, capacity, health, alignment", async () => {
    const { organizationEngine } = await import(
      "../../../bhudhi/organization/organization-engine/OrganizationEngine.js"
    );
    const output = await organizationEngine.process(baseInput);

    expect(output.organizationState.organizationId).toBeTruthy();
    expect(output.capacity.total).toBeGreaterThan(0);
    expect(output.health.score).toBeGreaterThanOrEqual(0);
    expect(output.alignment.score).toBeGreaterThan(0);
    expect(output.graph.nodes.length).toBeGreaterThan(0);
  });

  it("formatOrganizationContext answers ownership and health", async () => {
    const { organizationEngine } = await import(
      "../../../bhudhi/organization/organization-engine/OrganizationEngine.js"
    );
    const output = await organizationEngine.process(baseInput);
    const ctx = organizationEngine.formatOrganizationContext(output);
    expect(ctx).toContain("Org:");
    expect(ctx).toContain("health");
  });
});
