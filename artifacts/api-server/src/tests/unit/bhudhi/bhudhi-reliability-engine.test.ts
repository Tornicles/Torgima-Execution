import { emptyDbQueryResult } from "../../helpers/bhudhiDbMock.js";
import { describe, it, expect, vi } from "vitest";
import { reliabilityPolicy } from "../../../bhudhi/reliability/policy/ReliabilityPolicy.js";
import { failureDetector } from "../../../bhudhi/reliability/fault-detection/FailureDetector.js";
import { chaosEngine } from "../../../bhudhi/reliability/chaos/ChaosEngine.js";
import { containmentEngine } from "../../../bhudhi/reliability/containment/ContainmentEngine.js";
import { rollbackEngine } from "../../../bhudhi/reliability/rollback/RollbackEngine.js";
import { recoveryEngine } from "../../../bhudhi/reliability/recovery/RecoveryEngine.js";
import { resilienceEngine } from "../../../bhudhi/reliability/resilience/ResilienceEngine.js";
import { continuityEngine } from "../../../bhudhi/reliability/continuity/ContinuityEngine.js";
import { reliabilityObservatory } from "../../../bhudhi/reliability/observability/ReliabilityObservatory.js";
import { incidentCommander } from "../../../bhudhi/reliability/incidents/IncidentCommander.js";
import { reliabilityMemory } from "../../../bhudhi/reliability/reliability-memory/ReliabilityMemory.js";

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
    bhudhiReliabilityEvents: {},
    bhudhiIncidentLogs: {},
    bhudhiRollbackHistory: {},
    bhudhiRecoveryRecords: {},
    bhudhiSystemHealth: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-000000000008",
  execution: { uptime: 0.98, latencyMs: 200 },
  world: { stress: 0.2 },
  decision: { impact: 0.6 },
  economics: { roi: 0.7 },
  memory: { driftDetected: false },
};

describe("BRE — ReliabilityPolicy", () => {
  it("rejects forbidden constraints", () => {
    const r = reliabilityPolicy.validate({ ...baseInput, constraints: ["ERASE_FAILURES"] });
    expect(r.allowed).toBe(false);
  });
});

describe("BRE — FailureDetector", () => {
  it("detects timeouts drift deadlock loops dependency exhaustion", () => {
    const incidents = failureDetector.detect({
      ...baseInput,
      execution: {
        timeout: true,
        hallucination: true,
        deadlock: true,
        loopDetected: true,
        dependencyFailure: true,
        resourceExhaustion: true,
        latencyMs: 45000,
      },
      memory: { driftDetected: true },
    });
    expect(incidents.some((i) => i.incident === "timeout")).toBe(true);
    expect(["INFO", "WARNING", "MAJOR", "CRITICAL", "SYSTEM"]).toContain(
      failureDetector.topSeverity(incidents),
    );
  });
});

describe("BRE — ChaosEngine", () => {
  it("never runs in production without governance approval", () => {
    expect(chaosEngine.canRun({ ...baseInput, chaosMode: "DISABLED" })).toBe(false);
    expect(chaosEngine.canRun({ ...baseInput, chaosMode: "LAB" })).toBe(false);
    expect(
      chaosEngine.canRun({ ...baseInput, chaosMode: "LAB", governanceApproved: true }),
    ).toBe(true);
    expect(chaosEngine.canRun({ ...baseInput, chaosMode: "SAFE" })).toBe(true);
  });
});

describe("BRE — ContainmentEngine", () => {
  it("contains failures locally", () => {
    const incidents = failureDetector.detect({
      ...baseInput,
      execution: { deadlock: true },
    });
    const c = containmentEngine.contain(incidents);
    expect(c.some((x) => x.action === "freeze" || x.action === "isolate")).toBe(true);
  });
});

describe("BRE — RollbackEngine", () => {
  it("rollback preserves history", () => {
    const r = rollbackEngine.rollback(baseInput, "execution", "SOFT");
    expect(r.preservedHistory).toBe(true);
    expect(r.steps.length).toBeGreaterThan(0);
  });
});

describe("BRE — RecoveryEngine", () => {
  it("returns strategy confidence estimatedRecovery", () => {
    const incidents = failureDetector.detect(baseInput);
    const r = recoveryEngine.recover(baseInput, incidents);
    expect(r.strategy).toBeTruthy();
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.estimatedRecovery).toBeGreaterThan(0);
  });
});

describe("BRE — ResilienceEngine", () => {
  it("generates resilience score 0–100", () => {
    const incidents = failureDetector.detect(baseInput);
    const m = resilienceEngine.score(baseInput, incidents);
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.score).toBeLessThanOrEqual(100);
  });
});

describe("BRE — ContinuityEngine", () => {
  it("guarantees continuity modes", () => {
    const incidents = failureDetector.detect({
      ...baseInput,
      execution: { deadlock: true },
    });
    const c = continuityEngine.evaluate(baseInput, incidents);
    expect(["ONLINE", "DEGRADED", "OFFLINE", "RECOVERY"]).toContain(c.mode);
    expect(c.guarantees.length).toBeGreaterThan(0);
  });
});

describe("BRE — ReliabilityObservatory", () => {
  it("tracks latency incidents availability", () => {
    const snap = reliabilityObservatory.observe(baseInput, 2, 1);
    expect(snap.retention).toBeTruthy();
    expect(reliabilityObservatory.retentionWindows()).toContain("7d");
  });
});

describe("BRE — ReliabilityEngine", () => {
  it("check answers what can fail and how to protect", async () => {
    const { reliabilityEngine } = await import(
      "../../../bhudhi/reliability/reliability-engine/ReliabilityEngine.js"
    );
    const out = await reliabilityEngine.check(baseInput);
    expect(out.health).toBeGreaterThanOrEqual(0);
    expect(out.failureProbability).toBeGreaterThanOrEqual(0);
    expect(out.recommendedProtection).toBeTruthy();
  });

  it("validateBeforeExecution blocks freeze containment", async () => {
    const { reliabilityEngine } = await import(
      "../../../bhudhi/reliability/reliability-engine/ReliabilityEngine.js"
    );
    const gate = await reliabilityEngine.validateBeforeExecution({
      ...baseInput,
      execution: { deadlock: true },
    });
    expect(gate.allowed).toBe(false);
  });

  it("incident commander runs full flow", async () => {
    const { reliabilityEngine } = await import(
      "../../../bhudhi/reliability/reliability-engine/ReliabilityEngine.js"
    );
    const inc = await reliabilityEngine.incident({
      ...baseInput,
      execution: { timeout: true },
    });
    expect(inc.incidentId).toBeTruthy();
    expect(inc.owner).toBeTruthy();
    const out = await reliabilityEngine.check(baseInput);
    reliabilityMemory.store(baseInput.blueprintId, out);
    expect(reliabilityMemory.get(baseInput.blueprintId)?.sessionId).toBe(out.sessionId);
  });
});
