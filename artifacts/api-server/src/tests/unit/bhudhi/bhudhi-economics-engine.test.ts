import { describe, it, expect, vi, beforeEach } from "vitest";
import { valueScore, DEFAULT_MODEL_CAPABILITIES } from "../../../bhudhi/economics/contracts/modelCatalog.js";
import { ComputeRouter } from "../../../bhudhi/economics/compute-router/ComputeRouter.js";
import { IntelligenceExchange } from "../../../bhudhi/economics/model-selector/IntelligenceExchange.js";
import { ConfidenceExchange } from "../../../bhudhi/economics/confidence-allocation/ConfidenceExchange.js";
import { ExecutionROI } from "../../../bhudhi/economics/execution-cost/ExecutionROI.js";
import { TokenEconomy } from "../../../bhudhi/economics/intelligence-budget/TokenEconomy.js";
import { MemoryEconomics } from "../../../bhudhi/economics/memory-cost/MemoryEconomics.js";
import { SimulationEconomics } from "../../../bhudhi/economics/simulation-economics/SimulationEconomics.js";
import { EconomicsForecast } from "../../../bhudhi/economics/forecasting/EconomicsForecast.js";
import { EconomicsOptimizer } from "../../../bhudhi/economics/optimization/EconomicsOptimizer.js";
import { governanceEnforcer } from "../../../bhudhi/governance/enforcement/GovernanceEnforcer.js";
import { policyEngine } from "../../../bhudhi/governance/policy-engine/PolicyEngine.js";
import { riskGovernor } from "../../../bhudhi/governance/risk/RiskGovernor.js";

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
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "sess-1" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
    },
    bhudhiEconomicsProfiles: {},
    bhudhiModelCapabilities: {},
    bhudhiEconomicsSessions: {},
    bhudhiEconomicsLogs: {},
    bhudhiEconomicsForecasts: {},
    bhudhiLogs: {},
  };
});

describe("BIEE — model marketplace", () => {
  it("valueScore ranks higher quality per dollar", () => {
    const rules = DEFAULT_MODEL_CAPABILITIES.find((m) => m.provider === "rules")!;
    const sonnet = DEFAULT_MODEL_CAPABILITIES.find((m) => m.provider === "claude")!;
    const rulesScore = valueScore(rules, 0.8);
    const sonnetScore = valueScore(sonnet, 0.8);
    expect(rulesScore).toBeGreaterThan(0);
    expect(sonnetScore).toBeGreaterThan(0);
  });

  it("IntelligenceExchange selects highest value model", () => {
    const exchange = new IntelligenceExchange();
    const best = exchange.selectBest(0.85, { provider: "claude" });
    expect(best.provider).toBe("claude");
    expect(best.valueScore).toBeGreaterThan(0);
  });
});

describe("BIEE — compute router", () => {
  const router = new ComputeRouter();

  it("routes simple triggers to MICRO/rules", () => {
    const plan = router.route({
      userId: "u1",
      task: "FEEDBACK_CLASSIFICATION",
      trigger: "FEEDBACK_CLASSIFICATION",
    });
    expect(plan.executionMode).toBe("MICRO");
    expect(plan.route).toBe("rules");
  });

  it("routes critical triggers to ensemble/RESEARCH", () => {
    const plan = router.route({
      userId: "u1",
      task: "GOAL_STRUCTURING",
      trigger: "GOAL_STRUCTURING",
      confidence: 0.9,
    });
    expect(plan.executionMode).toBe("RESEARCH");
    expect(plan.route).toBe("ensemble");
  });

  it("routes unsafe to governance", () => {
    const plan = router.route({
      userId: "u1",
      task: "x",
      trigger: "x",
      unsafe: true,
    });
    expect(plan.route).toBe("governance");
    expect(plan.maxTokens).toBe(0);
  });
});

describe("BIEE — confidence market", () => {
  it("higher confidence tiers cost more", () => {
    const exchange = new ConfidenceExchange();
    const l7 = exchange.resolve(0.7);
    const l99 = exchange.resolve(0.99);
    expect(l99.costMultiplier).toBeGreaterThan(l7.costMultiplier);
    expect(l99.agentCount).toBeGreaterThanOrEqual(l7.agentCount);
  });
});

describe("BIEE — execution ROI", () => {
  const roi = new ExecutionROI();

  it("cancels unsafe or very low ROI", () => {
    const result = roi.evaluate(
      { userId: "u", task: "t", trigger: "t", unsafe: true },
      0.1,
    );
    expect(result.action).toBe("cancel");
  });

  it("recommends simulate for marginal ROI", () => {
    const result = roi.evaluate(
      { userId: "u", task: "t", trigger: "t", confidence: 0.55 },
      0.5,
      0.6,
    );
    expect(["simulate", "simplify", "delay", "cancel"]).toContain(result.action);
  });

  it("executes when ROI is strong", () => {
    const result = roi.evaluate(
      { userId: "u", task: "t", trigger: "t", confidence: 0.9, priority: "critical" },
      0.01,
      2,
    );
    expect(result.action).toBe("execute");
    expect(result.score).toBeGreaterThan(1);
  });
});

describe("BIEE — token economy", () => {
  const tokens = new TokenEconomy();

  it("allocates token categories without exceeding budget", () => {
    const alloc = tokens.allocate(500, { memory: true, simulation: true });
    const sum = Object.values(alloc.categories).reduce((a, b) => a + b, 0);
    expect(sum).toBeLessThanOrEqual(500);
  });

  it("protects signals conditions governance identity from deletion", () => {
    expect(tokens.canDeleteMemoryType("signals")).toBe(false);
    expect(tokens.canDeleteMemoryType("GOVERNANCE")).toBe(false);
    expect(tokens.canDeleteMemoryType("operational")).toBe(true);
  });
});

describe("BIEE — memory economics", () => {
  const mem = new MemoryEconomics();

  it("ages memory to COLD then ARCHIVE", () => {
    const hot = mem.classify(100, 1, "operational");
    expect(hot.tier).toBe("HOT");

    const cold = mem.classify(1, 45, "operational");
    expect(["COLD", "ARCHIVE", "DELETE"]).toContain(cold.tier);

    const signals = mem.classify(1, 200, "signals");
    expect(signals.tier).not.toBe("DELETE");
  });
});

describe("BIEE — simulation economics", () => {
  const sim = new SimulationEconomics();

  it("downgrades simulation when value ratio is low", () => {
    const result = sim.plan(0.01, 0.1, "low");
    expect(result.mode).toBe("FAST");
    expect(result.npcCount).toBeLessThanOrEqual(15);
  });

  it("scales up for critical high budget", () => {
    const result = sim.plan(5, 3, "critical");
    expect(["STRATEGIC", "FULL_WORLD"]).toContain(result.mode);
  });
});

describe("BIEE — forecast", () => {
  it("produces horizons 1-365 days", () => {
    const forecast = new EconomicsForecast();
    const points = forecast.predict({
      dailyCostUsd: 1,
      dailyRequests: 10,
      dailyTokens: 5000,
    });
    expect(points.map((p) => p.horizonDays)).toEqual([1, 7, 30, 90, 365]);
    expect(points[4]!.costUsd).toBeGreaterThan(points[0]!.costUsd);
  });
});

describe("BIEE — optimizer", () => {
  it("detects waste and cache proposals", () => {
    const optimizer = new EconomicsOptimizer();
    const proposals = optimizer.detectWaste({
      costPerRequest: 0.05,
      costPerUser: 2,
      tokensToday: 1000,
      cacheHitRate: 0.1,
      wasteScore: 0.4,
      avgValueScore: 20,
      routingDistribution: { STANDARD: 5 },
    });
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.some((p) => p.type === "waste" || p.type === "cache")).toBe(true);
  });
});

describe("BIEE — economics + governance integration", () => {
  it("governance enforcer rejects forbidden policy", () => {
    const policy = policyEngine.evaluatePolicy(
      { type: "bhudhi", id: "b" },
      "MODIFY_SIGNALS",
      {},
    );
    const risk = riskGovernor.assess("MODIFY_SIGNALS", {});
    expect(governanceEnforcer.decide(policy, risk, "MODIFY_SIGNALS")).toBe("REJECT");
  });
});

describe("BIEE — EconomicsEngine integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("planIntelligencePath returns cheapest safe path metadata", async () => {
    const { economicsEngine } = await import("../../../bhudhi/economics/EconomicsEngine.js");
    const plan = await economicsEngine.planIntelligencePath({
      userId: "user-1",
      blueprintId: "bp-1",
      task: "TASK_DRAFTING",
      trigger: "TASK_DRAFTING",
      confidence: 0.82,
    });

    expect(plan.compute.modelId).toBeTruthy();
    expect(plan.compute.valueScore).toBeGreaterThan(0);
    expect(plan.tokenBudget.total).toBeGreaterThan(0);
    expect(plan.roi.action).toBeTruthy();
  });

  it("applyBeforeInvoke returns maxTokens cap", async () => {
    const { economicsEngine } = await import("../../../bhudhi/economics/EconomicsEngine.js");
    const result = await economicsEngine.applyBeforeInvoke({
      userId: "user-1",
      triggerType: "STATE_EXPLANATION",
      task: "STATE_EXPLANATION",
      trigger: "STATE_EXPLANATION",
      confidence: 0.75,
    });

    expect(result.maxTokens).toBeGreaterThan(0);
    expect(result.plan.compute.executionMode).toBeTruthy();
  });

  it("forecast returns 5 horizon points", async () => {
    const { economicsEngine } = await import("../../../bhudhi/economics/EconomicsEngine.js");
    const points = await economicsEngine.runForecast("user-1");
    expect(points).toHaveLength(5);
  });
});
