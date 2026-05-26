import { describe, it, expect, vi } from "vitest";
import { infrastructurePolicy } from "../../../bhudhi/infrastructure/policy/InfrastructurePolicy.js";
import { runtimeEngine } from "../../../bhudhi/infrastructure/runtime/RuntimeEngine.js";
import { deploymentEngine } from "../../../bhudhi/infrastructure/deployment/DeploymentEngine.js";
import { scalingEngine } from "../../../bhudhi/infrastructure/scaling/ScalingEngine.js";
import { resourceAllocator } from "../../../bhudhi/infrastructure/allocation/ResourceAllocator.js";
import { tenancyEngine } from "../../../bhudhi/infrastructure/tenancy/TenancyEngine.js";
import { edgeEngine } from "../../../bhudhi/infrastructure/edge/EdgeEngine.js";
import { infrastructureRecovery } from "../../../bhudhi/infrastructure/recovery/InfrastructureRecovery.js";
import { infrastructureMemory } from "../../../bhudhi/infrastructure/infrastructure-memory/InfrastructureMemory.js";

vi.mock("@workspace/db", () => {
  function emptyQueryResult(): Promise<unknown[]> & {
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  } {
    const promise = Promise.resolve([]) as Promise<unknown[]> & {
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
          where: vi.fn(() => emptyQueryResult()),
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
    },
    bhudhiInfraRuntime: {},
    bhudhiInfraCapacity: {},
    bhudhiInfraDeployments: {},
    bhudhiInfraEvents: {},
    bhudhiInfraHealth: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-00000000000a",
  execution: { status: "pending" },
  economics: { estimatedCost: 0.12 },
  traffic: { load: 0.45, users: 200, latencyMs: 120 },
  security: { risk: 0.2 },
};

describe("BIIE — InfrastructurePolicy", () => {
  it("rejects deploy without recovery", () => {
    const r = infrastructurePolicy.validate({ ...baseInput, constraints: ["DEPLOY_WITHOUT_RECOVERY"] });
    expect(r.allowed).toBe(false);
  });
});

describe("BIIE — RuntimeEngine", () => {
  it("observes runtime health latency throughput", () => {
    const r = runtimeEngine.observe(baseInput);
    expect(["local", "container", "cloud", "edge", "hybrid"]).toContain(r.runtime);
    expect(r.health).toBeGreaterThan(0);
    expect(r.recommendation).toBeTruthy();
  });
});

describe("BIIE — DeploymentEngine", () => {
  it("always provides rollback", () => {
    const p = deploymentEngine.plan(baseInput, 0.5);
    expect(p.rollbackAvailable).toBe(true);
    expect(p.steps.some((s) => s.toLowerCase().includes("rollback"))).toBe(true);
  });
});

describe("BIIE — ScalingEngine", () => {
  it("forecasts scale and cost", () => {
    const s = scalingEngine.forecast(baseInput, 0.6);
    expect(s.scale).toBeGreaterThanOrEqual(1);
    expect(s.cost).toBeGreaterThan(0);
    expect(["MANUAL", "AUTO", "PREDICTIVE", "GOVERNED"]).toContain(s.mode);
  });
});

describe("BIIE — ResourceAllocator", () => {
  it("allocates cpu memory gpu storage network", () => {
    const a = resourceAllocator.allocate(baseInput);
    expect(a.allocated.cpu).toBeGreaterThan(0);
    const cap = resourceAllocator.capacityFromAllocation(a);
    expect(cap.canSupport).toBe(true);
  });
});

describe("BIIE — TenancyEngine", () => {
  it("blocks cross tenant contamination", () => {
    const t = tenancyEngine.evaluate({ ...baseInput, execution: { crossTenant: true } });
    expect(t.violations.length).toBeGreaterThan(0);
  });
});

describe("BIIE — EdgeEngine", () => {
  it("routes to local on high latency", () => {
    const e = edgeEngine.route({ ...baseInput, traffic: { latencyMs: 900, edge: true } });
    expect(e.mode).toBe("LOCAL");
    expect(e.localExecution).toBe(true);
  });
});

describe("BIIE — InfrastructureRecovery", () => {
  it("recovers deployment with rollback", () => {
    const r = infrastructureRecovery.recover(baseInput, "deployment");
    expect(r.action).toBe("rollback");
    expect(r.steps.length).toBeGreaterThan(0);
  });
});

describe("BIIE — InfrastructureEngine", () => {
  it("observe answers where will this run", async () => {
    const { infrastructureEngine } = await import(
      "../../../bhudhi/infrastructure/infrastructure-engine/InfrastructureEngine.js"
    );
    const out = await infrastructureEngine.observe(baseInput);
    expect(out.environment).toBeTruthy();
    expect(out.deploymentPlan.strategy).toBeTruthy();
    expect(out.capacity.canSupport).toBe(true);
  });

  it("validateBeforeExecution blocks constrained capacity", async () => {
    const { infrastructureEngine } = await import(
      "../../../bhudhi/infrastructure/infrastructure-engine/InfrastructureEngine.js"
    );
    const gate = await infrastructureEngine.validateBeforeExecution({
      ...baseInput,
      traffic: { load: 0.99 },
      execution: { crossTenant: true },
    });
    expect(gate.allowed).toBe(false);
  });

  it("stores infrastructure memory", async () => {
    const { infrastructureEngine } = await import(
      "../../../bhudhi/infrastructure/infrastructure-engine/InfrastructureEngine.js"
    );
    const out = await infrastructureEngine.observe(baseInput);
    infrastructureMemory.store(baseInput.blueprintId, out);
    expect(infrastructureMemory.get(baseInput.blueprintId)?.sessionId).toBe(out.sessionId);
  });
});
