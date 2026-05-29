import { emptyDbQueryResult } from "../../helpers/bhudhiDbMock.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { temporalPolicy } from "../../../bhudhi/temporal/policy/TemporalPolicy.js";
import { chronologyEngine } from "../../../bhudhi/temporal/chronology/ChronologyEngine.js";
import { opportunityEngine } from "../../../bhudhi/temporal/opportunity/OpportunityEngine.js";
import { momentumEngine } from "../../../bhudhi/temporal/momentum/MomentumEngine.js";
import { executionWindows } from "../../../bhudhi/temporal/windows/ExecutionWindows.js";
import { timelineEngine } from "../../../bhudhi/temporal/timeline/TimelineEngine.js";
import { branchingEngine } from "../../../bhudhi/temporal/branching/BranchingEngine.js";
import { schedulingEngine } from "../../../bhudhi/temporal/scheduling/SchedulingEngine.js";
import { temporalForecast } from "../../../bhudhi/temporal/forecasting/TemporalForecast.js";
import { temporalMemory } from "../../../bhudhi/temporal/temporal-memory/TemporalMemory.js";

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
    bhudhiTemporalTimelines: {},
    bhudhiTemporalWindows: {},
    bhudhiTemporalForecasts: {},
    bhudhiTemporalPatterns: {},
    bhudhiTemporalHistory: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-000000000006",
  goal: "Ship validation milestone",
  world: { volatility: 0.4 },
  life: { energyLevel: 0.7 },
  signals: { deadlinePressure: 0.6 },
  deadlines: [{ label: "MVP", at: new Date(Date.now() + 7 * 86400000).toISOString() }],
  tasks: [{ id: "t1", title: "Review tasks" }],
};

describe("BTIE — TemporalPolicy", () => {
  it("rejects forbidden constraints", () => {
    const r = temporalPolicy.validate({ ...baseInput, constraints: ["IGNORE_SIGNALS"] });
    expect(r.allowed).toBe(false);
  });
});

describe("BTIE — ChronologyEngine", () => {
  it("sequences past present future with causes", () => {
    const c = chronologyEngine.sequence(baseInput);
    expect(c.ordering.length).toBeGreaterThan(0);
    expect(c.causes.length).toBeGreaterThan(0);
  });
});

describe("BTIE — OpportunityEngine", () => {
  it("scores opportunity 0–100", () => {
    const o = opportunityEngine.detect(baseInput);
    expect(o.score).toBeGreaterThanOrEqual(0);
    expect(o.score).toBeLessThanOrEqual(100);
    expect(o.recommendedAction).toBeTruthy();
  });
});

describe("BTIE — MomentumEngine", () => {
  it("tracks trajectory modes", () => {
    const m = momentumEngine.track(baseInput);
    expect(["RISING", "STABLE", "DECLINING", "COLLAPSING"]).toContain(m.trajectory);
    expect(m.momentum).toBeGreaterThanOrEqual(0);
  });
});

describe("BTIE — ExecutionWindows", () => {
  it("generates best acceptable avoid windows", () => {
    const w = executionWindows.generate(baseInput, 0.2);
    expect(w.best.window).toBe("best");
    expect(w.avoid.window).toBe("avoid");
    expect(w.primary.successProbability).toBeGreaterThan(0);
  });
});

describe("BTIE — TimelineEngine", () => {
  it("builds adaptive timeline with buffer", () => {
    const t = timelineEngine.build(baseInput);
    expect(t.timeline.length).toBeGreaterThan(0);
    expect(t.buffer).toBeGreaterThanOrEqual(0);
  });
});

describe("BTIE — BranchingEngine", () => {
  it("evaluates paths with regret", () => {
    const b = branchingEngine.evaluate(baseInput);
    expect(b.alternatives.length).toBeGreaterThanOrEqual(3);
    expect(b.recommendedPath).toBeTruthy();
  });
});

describe("BTIE — SchedulingEngine", () => {
  it("protects sleep health signals", () => {
    const s = schedulingEngine.schedule(baseInput);
    expect(s.protected).toContain("sleep");
    expect(s.protected).toContain("health");
  });
});

describe("BTIE — TemporalForecast", () => {
  it("forecasts 1/7/30/90/365 day horizons", () => {
    const f = temporalForecast.forecast(baseInput, 0.6);
    const days = f.horizons.map((h) => h.days);
    expect(days).toContain(1);
    expect(days).toContain(7);
    expect(days).toContain(30);
    expect(days).toContain(90);
    expect(days).toContain(365);
  });
});

describe("BTIE — TemporalMemory", () => {
  it("stores and retrieves active temporal memory", async () => {
    const { temporalEngine } = await import(
      "../../../bhudhi/temporal/temporal-engine/TemporalEngine.js"
    );
    const out = await temporalEngine.analyze(baseInput);
    temporalMemory.store(baseInput.blueprintId, out);
    const cached = temporalMemory.get(baseInput.blueprintId);
    expect(cached?.sessionId).toBe(out.sessionId);
  });
});

describe("BTIE — TemporalEngine", () => {
  it("analyze answers why now with urgency and window", async () => {
    const { temporalEngine } = await import(
      "../../../bhudhi/temporal/temporal-engine/TemporalEngine.js"
    );
    const out = await temporalEngine.analyze(baseInput);
    expect(out.recommendation.length).toBeGreaterThan(0);
    expect(out.urgency).toBeGreaterThanOrEqual(0);
    expect(out.window.window).toBeTruthy();
    expect(out.timeState.phase).toBe("present");
  });

  it("validateExecutionTiming blocks avoid window unless urgent", async () => {
    const { temporalEngine } = await import(
      "../../../bhudhi/temporal/temporal-engine/TemporalEngine.js"
    );
    const lowEnergy = await temporalEngine.analyze({
      ...baseInput,
      life: { energyLevel: 0.1 },
    });
    if (lowEnergy.window.window === "avoid" && lowEnergy.urgency < 0.85) {
      const gate = await temporalEngine.validateExecutionTiming(baseInput.blueprintId, {
        life: { energyLevel: 0.1 },
      });
      expect(gate.allowed).toBe(false);
    }
  });
});
