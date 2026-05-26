import { describe, it, expect, vi } from "vitest";
import { governorPolicy } from "../../../bhudhi/governor/policy/GovernorPolicy.js";
import { priorityEngine } from "../../../bhudhi/governor/priority/PriorityEngine.js";
import { arbitrationEngine } from "../../../bhudhi/governor/arbitration/ArbitrationEngine.js";
import { allocationGovernor } from "../../../bhudhi/governor/allocation/AllocationGovernor.js";
import { interruptionEngine } from "../../../bhudhi/governor/interruption/InterruptionEngine.js";
import { recoveryGovernor } from "../../../bhudhi/governor/recovery/RecoveryGovernor.js";
import { systemOrchestrator } from "../../../bhudhi/governor/orchestration/SystemOrchestrator.js";
import { supervisor } from "../../../bhudhi/governor/supervision/Supervisor.js";
import { governorOptimization } from "../../../bhudhi/governor/optimization/GovernorOptimization.js";
import { governorMemory } from "../../../bhudhi/governor/governor-memory/GovernorMemory.js";

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
    bhudhiGovernorEvents: {},
    bhudhiGovernorAllocations: {},
    bhudhiGovernorRecovery: {},
    bhudhiGovernorHistory: {},
    bhudhiGovernorHealth: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-000000000007",
  world: { risk: 0.3 },
  decisions: { impact: 0.7 },
  execution: { status: "pending" },
  economics: { roi: 0.65 },
  identity: { burnout: 0.2 },
  organization: { utilization: 0.5, alignment: 0.7, healthScore: 72 },
  time: { urgency: 0.6, opportunityScore: 75 },
};

describe("BMGE — GovernorPolicy", () => {
  it("rejects forbidden constraints", () => {
    const r = governorPolicy.validate({ ...baseInput, constraints: ["APPROVE_SELF"] });
    expect(r.allowed).toBe(false);
  });
});

describe("BMGE — PriorityEngine", () => {
  it("scores dynamic priority levels", () => {
    const map = priorityEngine.buildMap(baseInput);
    expect(["CRITICAL", "HIGH", "NORMAL", "LOW", "BACKGROUND"]).toContain(
      map.topPriority.priority,
    );
    expect(map.entries.length).toBeGreaterThan(0);
  });
});

describe("BMGE — ArbitrationEngine", () => {
  it("resolves conflicts explicitly", () => {
    const conflicts = arbitrationEngine.resolve({
      ...baseInput,
      execution: { agentConflict: true },
      economics: { blocked: true },
    });
    expect(conflicts.some((c) => c.verdict === "merge" || c.verdict === "escalate")).toBe(true);
  });

  it("approves when no conflicts", () => {
    const conflicts = arbitrationEngine.resolve(baseInput);
    expect(conflicts[0]?.verdict).toBe("approve");
  });
});

describe("BMGE — AllocationGovernor", () => {
  it("allocates resources by priority", () => {
    const map = priorityEngine.buildMap(baseInput);
    const alloc = allocationGovernor.allocate(baseInput, map);
    expect(Object.keys(alloc.allocation).length).toBeGreaterThan(0);
    expect(alloc.recommendation).toBeTruthy();
  });
});

describe("BMGE — InterruptionEngine", () => {
  it("interrupts on burnout budget drift governance", () => {
    const i = interruptionEngine.detect({
      ...baseInput,
      identity: { burnout: 0.85 },
      economics: { blocked: true },
    });
    expect(i.some((x) => x.type === "pause" || x.type === "freeze")).toBe(true);
    expect(interruptionEngine.shouldBlock(i)).toBe(true);
  });
});

describe("BMGE — RecoveryGovernor", () => {
  it("recovers with history preserved", () => {
    const r = recoveryGovernor.recover(baseInput, "execution", "adaptive");
    expect(r.preservedHistory).toBe(true);
    expect(r.steps.length).toBeGreaterThan(0);
  });
});

describe("BMGE — SystemOrchestrator", () => {
  it("coordinates subsystem actions", () => {
    const map = priorityEngine.buildMap(baseInput);
    const interventions = interruptionEngine.detect(baseInput);
    const state = systemOrchestrator.coordinate(baseInput, map, interventions);
    expect(state.execution).toBeTruthy();
    expect(state.memory).toBeTruthy();
  });
});

describe("BMGE — Supervisor", () => {
  it("generates system health", () => {
    const h = supervisor.assess(baseInput);
    expect(["healthy", "degraded", "critical", "stable"]).toContain(h.systemHealth);
  });
});

describe("BMGE — GovernorOptimization", () => {
  it("recommends improvements in measure loop", () => {
    const h = supervisor.assess(baseInput);
    const map = priorityEngine.buildMap(baseInput);
    const alloc = allocationGovernor.allocate(baseInput, map);
    const recs = governorOptimization.recommend(baseInput, h, alloc);
    expect(recs.length).toBeGreaterThan(0);
  });
});

describe("BMGE — MetaGovernor", () => {
  it("observe answers what matters most", async () => {
    const { metaGovernor } = await import("../../../bhudhi/governor/governor-engine/MetaGovernor.js");
    const out = await metaGovernor.observe(baseInput);
    expect(out.priorityMap.topPriority.subsystem).toBeTruthy();
    expect(out.executionPlan.sequence.length).toBeGreaterThan(0);
    expect(out.interventions).toBeDefined();
  });

  it("validateBeforeGovernance blocks severe interventions", async () => {
    const { metaGovernor } = await import("../../../bhudhi/governor/governor-engine/MetaGovernor.js");
    const gate = await metaGovernor.validateBeforeGovernance({
      ...baseInput,
      identity: { burnout: 0.95 },
      execution: { governanceViolation: true },
    });
    expect(gate.allowed).toBe(false);
  });

  it("stores governor memory", async () => {
    const { metaGovernor } = await import("../../../bhudhi/governor/governor-engine/MetaGovernor.js");
    const out = await metaGovernor.observe(baseInput);
    governorMemory.store(baseInput.blueprintId, out);
    expect(governorMemory.get(baseInput.blueprintId)?.sessionId).toBe(out.sessionId);
  });
});
