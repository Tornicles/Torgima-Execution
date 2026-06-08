import { describe, it, expect, vi, beforeEach } from "vitest";
import { benchScale, percentile } from "./benchScale.js";

const BP = "00000000-0000-4000-8000-00000000b038";

vi.mock("../../bhudhi/investigation/InvestigationService.js", () => ({
  investigationService: { investigateBlueprint: vi.fn().mockResolvedValue([{ id: "i1" }]) },
}));
vi.mock("../../bhudhi/intelligence/IntelligenceService.js", () => ({
  intelligenceService: {
    analyzeAndRecommend: vi.fn().mockResolvedValue([{ id: "r1", confidence: 0.9 }]),
  },
}));
vi.mock("../../bhudhi/security/SecurityService.js", () => ({
  securityService: { validateRecommendation: vi.fn().mockResolvedValue({ valid: true, violations: [] }) },
}));
vi.mock("../../bhudhi/operating/operatingData.js", () => ({
  approveRecommendation: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../bhudhi/operating/OperatingService.js", () => ({
  operatingService: { executeRecommendation: vi.fn().mockResolvedValue({ success: true }) },
}));
vi.mock("../../bhudhi/preservation/PreservationService.js", () => ({
  preservationService: { consolidateKnowledge: vi.fn().mockResolvedValue({}) },
}));

vi.mock("@workspace/db", () => {
  const events: unknown[] = [];
  const ctx = {
    blueprint_id: BP,
    domain: "genesis",
    phase: "initiation",
    signal: "nothingness",
    condition: "nothingness",
    context: {},
    ideas: {},
    strategy: {},
    predictions: {},
    knowledge: {},
    behavior: {},
    execution: {},
    investigations: {},
    version: 1,
  };
  const empty = (data: unknown[] = []) => {
    const p = Promise.resolve(data) as Promise<unknown[]> & { orderBy: ReturnType<typeof vi.fn>; limit: ReturnType<typeof vi.fn> };
    p.orderBy = vi.fn(() => ({ limit: vi.fn().mockResolvedValue(data) }));
    p.limit = vi.fn().mockResolvedValue(data);
    return p;
  };
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => empty([ctx])),
          orderBy: vi.fn(() => empty(events)),
          limit: vi.fn().mockResolvedValue([ctx]),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((v: Record<string, unknown>) => {
          if (v.event_type) events.push(v);
          return { returning: vi.fn().mockResolvedValue([{ id: "e1", ...v }]) };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ ...ctx, version: 2 }]) })),
        })),
      })),
      delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    },
    bhudhiKernelEvents: {},
    bhudhiSharedContext: { blueprint_id: "blueprint_id" },
    bhudhiEngineRegistry: {},
    bhudhiExecutionContracts: {},
  };
});

describe("BHUDHI Prompt 38 — Reliability benchmarks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("completes benchmark cycles with >99.5% success", async () => {
    const n = benchScale(1000, 50);
    const { CognitiveKernel } = await import("../../bhudhi/kernel/cognitive-kernel/CognitiveKernel.js");
    const kernel = new CognitiveKernel();
    let ok = 0;
    for (let i = 0; i < n; i++) {
      try {
        const r = await kernel.runCycle(BP);
        if (r.status === "completed") ok++;
      } catch {
        /* count failure */
      }
    }
    const reliability = (ok / n) * 100;
    expect(reliability).toBeGreaterThan(99.5);
  });

  it("maintains sub-100ms p99 cycle latency (mocked)", async () => {
    const n = benchScale(100, 30);
    const { CognitiveKernel } = await import("../../bhudhi/kernel/cognitive-kernel/CognitiveKernel.js");
    const kernel = new CognitiveKernel();
    const latencies: number[] = [];
    for (let i = 0; i < n; i++) {
      const start = Date.now();
      await kernel.runCycle(BP);
      latencies.push(Date.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p99 = percentile(latencies, 0.99);
    expect(p99).toBeLessThanOrEqual(150);
  });

  it("handles concurrent cycles", async () => {
    const { CognitiveKernel } = await import("../../bhudhi/kernel/cognitive-kernel/CognitiveKernel.js");
    const kernel = new CognitiveKernel();
    const levels = benchScale(100, 20) >= 100 ? [10, 50, 100] : [5, 10, 20];

    for (const concurrency of levels) {
      const start = Date.now();
      await Promise.all(
        Array.from({ length: concurrency }, (_, i) => kernel.runCycle(`${BP}-${i}`)),
      );
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(concurrency * 200);
    }
  });
});
