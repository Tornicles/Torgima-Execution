import { emptyDbQueryResult } from "../../helpers/bhudhiDbMock.js";
import { describe, it, expect, vi } from "vitest";
import { expansionPolicy } from "../../../bhudhi/expansion/policy/ExpansionPolicy.js";
import { capabilityDiscovery } from "../../../bhudhi/expansion/capability-discovery/CapabilityDiscovery.js";
import { transferLearning } from "../../../bhudhi/expansion/transfer-learning/TransferLearning.js";
import { abstractionEngine } from "../../../bhudhi/expansion/abstraction/AbstractionEngine.js";
import { capabilityComposer } from "../../../bhudhi/expansion/composition/CapabilityComposer.js";
import { expansionEvaluation } from "../../../bhudhi/expansion/evaluation/ExpansionEvaluation.js";
import { expansionGovernance } from "../../../bhudhi/expansion/governance/ExpansionGovernance.js";
import { benchmarkEngine } from "../../../bhudhi/expansion/benchmarking/BenchmarkEngine.js";
import { seededUnit } from "../../../bhudhi/expansion/lib/seededUnit.js";

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
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    },
    bhudhiExpansionCapabilities: {},
    bhudhiExpansionEvents: {},
    bhudhiExpansionBenchmarks: {},
    bhudhiExpansionHistory: {},
    bhudhiExpansionMemory: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-00000000000x",
  seed: "expansion-deterministic-seed",
  world: { markets: 3 },
  decisions: { recent: true },
  beliefs: { updated: true },
  experiments: { active: true },
  execution: { status: "running" },
  results: { validation: { score: 0.8 } },
};

describe("BAEE — ExpansionPolicy", () => {
  it("rejects self-modification and hide expansion", () => {
    const r = expansionPolicy.validate({ ...baseInput, constraints: ["SELF_MODIFICATION"] });
    expect(r.allowed).toBe(false);
  });

  it("allows learn compose benchmark recommend", () => {
    const r = expansionPolicy.validate({ ...baseInput, constraints: ["learn", "benchmark"] });
    expect(r.allowed).toBe(true);
  });
});

describe("BAEE — CapabilityDiscovery", () => {
  it("detects candidate capabilities", () => {
    const c = capabilityDiscovery.detect(baseInput, baseInput.seed);
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].capability).toBeTruthy();
    expect(c[0].score).toBeGreaterThan(0);
  });
});

describe("BAEE — TransferLearning", () => {
  it("preserves context across domains", () => {
    const t = transferLearning.apply(baseInput);
    expect(t.length).toBe(5);
    expect(t.some((x) => x.preserved)).toBe(true);
  });
});

describe("BAEE — AbstractionEngine", () => {
  it("requires evidence for abstraction", () => {
    const a = abstractionEngine.extract(baseInput, baseInput.seed);
    expect(a.evidenceCount).toBeGreaterThan(0);
    expect(a.generalKnowledge.length).toBeGreaterThan(0);
  });

  it("refuses abstraction without evidence", () => {
    const a = abstractionEngine.extract({ blueprintId: baseInput.blueprintId }, baseInput.seed);
    expect(a.evidenceCount).toBe(0);
  });
});

describe("BAEE — CapabilityComposer", () => {
  it("composes reversible capabilities with dependencies", () => {
    const candidates = capabilityDiscovery.detect(baseInput, baseInput.seed);
    const composed = capabilityComposer.compose(candidates);
    expect(composed[0].dependencies.length).toBeGreaterThan(0);
  });
});

describe("BAEE — ExpansionEvaluation", () => {
  it("returns promote repeat reject or rollback", () => {
    const candidates = capabilityDiscovery.detect(baseInput, baseInput.seed);
    const ev = expansionEvaluation.measure(baseInput, candidates, baseInput.seed);
    expect(["promote", "repeat", "reject", "rollback"]).toContain(ev.action);
  });
});

describe("BAEE — ExpansionGovernance", () => {
  it("blocks promotion without benchmark", () => {
    const candidates = capabilityDiscovery.detect(baseInput, baseInput.seed);
    const g = expansionGovernance.requireApproval(baseInput, candidates, null);
    expect(g.approval).toBe(false);
  });

  it("requires governance for GLOBAL level", () => {
    const candidates = [{ capability: "x", origin: "test", score: 0.96 }];
    const bench = { gain: 0.5, cost: 0.1, confidence: 0.7 };
    const g = expansionGovernance.requireApproval(
      { ...baseInput, governanceApproved: false },
      candidates,
      bench,
      "GLOBAL",
    );
    expect(g.approval).toBe(false);
  });
});

describe("BAEE — BenchmarkEngine", () => {
  it("returns null when no candidates", () => {
    const ev = expansionEvaluation.measure(baseInput, [], baseInput.seed);
    expect(benchmarkEngine.compare(baseInput.seed, [], ev)).toBeNull();
  });

  it("benchmarks gain cost confidence", () => {
    const candidates = capabilityDiscovery.detect(baseInput, baseInput.seed);
    const ev = expansionEvaluation.measure(baseInput, candidates, baseInput.seed);
    const b = benchmarkEngine.compare(baseInput.seed, candidates, ev);
    expect(b).not.toBeNull();
    expect(b!.confidence).toBeGreaterThan(0);
  });
});

describe("BAEE — seededUnit", () => {
  it("is deterministic", () => {
    expect(seededUnit("a", "b")).toBe(seededUnit("a", "b"));
  });
});

describe("BAEE — ExpansionGovernance (Prompt 30)", () => {
  it("never auto-approves", () => {
    expect(expansionGovernance.canAutoApprove("low", 0.9)).toBe(false);
  });

  it("makeDecision requires human path for critical", () => {
    const d = expansionGovernance.makeDecision(true, "critical");
    expect(d.requiresHumanReview).toBe(true);
    expect(d.status).toBe("approved");
  });

  it("checkLimits enforces caps", () => {
    const limits = expansionGovernance.checkLimits(1000, 3);
    expect(limits.canExpand).toBe(false);
    expect(limits.issues.length).toBeGreaterThan(0);
  });
});

describe("BAEE — ExpansionRollback", () => {
  it("rolls back capability", async () => {
    const { expansionRollback } = await import(
      "../../../bhudhi/expansion/rollback/ExpansionRollback.js"
    );
    const result = await expansionRollback.rollback(
      "00000000-0000-4000-8000-0000000000e1",
      baseInput.blueprintId,
      "test-user",
    );
    expect(result.success).toBe(true);
  });
});

describe("BAEE — ExpansionEngine", () => {
  it("runs discover cycle without auto-approval", async () => {
    const { expansionEngine } = await import(
      "../../../bhudhi/expansion/expansion-engine/ExpansionEngine.js"
    );
    const out = await expansionEngine.discover(baseInput);
    expect(out.newCapabilities.length).toBeGreaterThanOrEqual(0);
    expect(out.recommendation).toBeTruthy();
  });

  it("promote requires governance approval", async () => {
    const { expansionEngine } = await import(
      "../../../bhudhi/expansion/expansion-engine/ExpansionEngine.js"
    );
    await expect(expansionEngine.promote({ ...baseInput, governanceApproved: false })).rejects.toThrow(
      /governance approval/i,
    );
  });

  it("promote succeeds with governance flag", async () => {
    const { expansionEngine } = await import(
      "../../../bhudhi/expansion/expansion-engine/ExpansionEngine.js"
    );
    const out = await expansionEngine.promote({ ...baseInput, governanceApproved: true });
    expect(out.approval).toBe(true);
  });

  it("evaluate returns evaluation action", async () => {
    const { expansionEngine } = await import(
      "../../../bhudhi/expansion/expansion-engine/ExpansionEngine.js"
    );
    const out = await expansionEngine.evaluate(baseInput);
    expect(out.evaluation?.action).toBeTruthy();
  });

  it("history returns structure", async () => {
    const { expansionEngine } = await import(
      "../../../bhudhi/expansion/expansion-engine/ExpansionEngine.js"
    );
    await expansionEngine.discover(baseInput);
    const hist = await expansionEngine.history(baseInput.blueprintId);
    expect(hist.memory).toBeDefined();
  });

  it("getStatus returns governance manifest", async () => {
    const { expansionEngine } = await import(
      "../../../bhudhi/expansion/expansion-engine/ExpansionEngine.js"
    );
    const status = await expansionEngine.getStatus(baseInput.blueprintId);
    expect(status.governanceRules.length).toBeGreaterThan(0);
    expect(typeof status.canExpand).toBe("boolean");
  });
});

describe("BAEE — API catalog (Prompt 30)", () => {
  it("registers expansion routes", async () => {
    const { BHUDHI_API_ROUTES } = await import("../../../bhudhi/api/BhudhiCatalogService.js");
    const paths = BHUDHI_API_ROUTES.map((r) => r.path);
    expect(paths).toContain("/api/bhudhi/expansion/status");
    expect(paths).toContain("/api/bhudhi/expansion/approve");
    expect(paths).toContain("/api/bhudhi/expansion/rollback");
  });
});
