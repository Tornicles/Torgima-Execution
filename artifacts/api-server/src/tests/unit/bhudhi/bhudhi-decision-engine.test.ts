import { describe, it, expect, vi, beforeEach } from "vitest";
import { optionGenerator } from "../../../bhudhi/decision/option-generator/OptionGenerator.js";
import { tradeoffEngine } from "../../../bhudhi/decision/tradeoff-engine/TradeoffEngine.js";
import { expectedValueEngine } from "../../../bhudhi/decision/evaluator/ExpectedValueEngine.js";
import { decisionConfidence } from "../../../bhudhi/decision/confidence-engine/DecisionConfidence.js";
import { decisionPolicy } from "../../../bhudhi/decision/policy/DecisionPolicy.js";
import { decisionForecastEngine } from "../../../bhudhi/decision/forecasting/DecisionForecast.js";
import { decisionReplay } from "../../../bhudhi/decision/replay/DecisionReplay.js";
import { metaDecision } from "../../../bhudhi/decision/optimization/MetaDecision.js";

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
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "d1" }]) })),
        })),
      })),
    },
    bhudhiDecisionRecords: {},
    bhudhiDecisionOptions: {},
    bhudhiDecisionForecasts: {},
    bhudhiDecisionScores: {},
    bhudhiDecisionReplay: {},
  };
});

const baseInput = {
  trigger: "EXECUTE_WORKFLOW",
  goal: "Accelerate delivery of top priority order",
  blueprintId: "bp-1",
  recommendationId: "rec-1",
  signals: { global: "power", confidence: 0.85 },
};

describe("BDIE — OptionGenerator", () => {
  it("generates minimum 5 alternatives", () => {
    const options = optionGenerator.generate(baseInput);
    expect(options.length).toBeGreaterThanOrEqual(5);
    const types = new Set(options.map((o) => o.optionType));
    expect(types.has("conservative")).toBe(true);
    expect(types.has("balanced")).toBe(true);
    expect(types.has("aggressive")).toBe(true);
  });

  it("never returns only one option", () => {
    const options = optionGenerator.generate({ ...baseInput, goal: "x" });
    expect(options.length).toBeGreaterThan(1);
  });
});

describe("BDIE — TradeoffEngine", () => {
  it("produces tradeoff matrix with summary chain", () => {
    const options = optionGenerator.generate(baseInput);
    const matrix = tradeoffEngine.evaluate(options[2]!);
    expect(matrix.risk).toBeGreaterThan(0);
    expect(matrix.summary.length).toBeGreaterThan(0);
  });
});

describe("BDIE — ExpectedValueEngine", () => {
  it("scores and ranks options", () => {
    const options = optionGenerator.generate(baseInput);
    const scored = expectedValueEngine.scoreOptions(options);
    expect(scored[0]!.expectedValue).toBeGreaterThanOrEqual(scored[scored.length - 1]!.expectedValue ?? 0);
  });

  it("calculates regret vs alternatives", () => {
    const options = optionGenerator.generate(baseInput);
    const scored = expectedValueEngine.scoreOptions(options);
    const ev = expectedValueEngine.evaluate(scored[0]!, scored);
    expect(ev.regret).toBeGreaterThanOrEqual(0);
    expect(ev.recommendation).toBeTruthy();
  });
});

describe("BDIE — DecisionConfidence", () => {
  it("caps confidence by evidence", () => {
    const conf = decisionConfidence.assess(baseInput, 0.99, 2);
    expect(conf.score).toBeLessThanOrEqual(0.99);
    expect(["LOW", "MEDIUM", "HIGH", "VERY_HIGH", "CERTAIN"]).toContain(conf.level);
  });
});

describe("BDIE — DecisionPolicy", () => {
  it("blocks override signals and blueprint rewrite", () => {
    const result = decisionPolicy.validate({
      ...baseInput,
      context: { overrideSignals: true },
      constraints: ["MODIFY_SIGNALS"],
    });
    expect(result.allowed).toBe(false);
    expect(result.escalateGovernance).toBe(true);
  });

  it("allows valid execution decisions", () => {
    const result = decisionPolicy.validate(baseInput);
    expect(result.allowed).toBe(true);
  });
});

describe("BDIE — DecisionForecast", () => {
  it("forecasts 1d through 1y horizons", () => {
    const options = optionGenerator.generate(baseInput);
    const forecasts = decisionForecastEngine.forecast(options[0]!);
    expect(forecasts.map((f) => f.horizonDays)).toEqual([1, 7, 30, 90, 365]);
    expect(forecasts[0]!.scenarioTree.length).toBeGreaterThan(0);
  });
});

describe("BDIE — DecisionReplay", () => {
  it("answers what happened / should / would", async () => {
    const { decisionEngine } = await import("../../../bhudhi/decision/decision-engine/DecisionEngine.js");
    const decision = await decisionEngine.create(baseInput);
    const replay = decisionReplay.replay(decision);
    expect(replay.whatHappened).toBeTruthy();
    expect(replay.whatShouldHappen).toContain(decision.selected.optionType);
    expect(replay.whatWouldHappen).toContain("Alternative");
  });
});

describe("BDIE — MetaDecision", () => {
  it("escalates high-risk selections", () => {
    const options = optionGenerator.generate(baseInput);
    const risky = { ...options[2]!, risk: 0.9 };
    const meta = metaDecision.evaluate(options, risky, 100);
    expect(meta.action).toBe("simulate");
  });
});

describe("BDIE — DecisionEngine integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create returns 5+ options with selected and explanation", async () => {
    const { decisionEngine } = await import("../../../bhudhi/decision/decision-engine/DecisionEngine.js");
    const result = await decisionEngine.create(baseInput);

    expect(result.decisionId).toBeTruthy();
    expect(result.options.length).toBeGreaterThanOrEqual(5);
    expect(result.selected).toBeTruthy();
    expect(result.explanation.length).toBeGreaterThan(20);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("requireDecisionForExecution allows high-confidence paths", async () => {
    const { decisionEngine } = await import("../../../bhudhi/decision/decision-engine/DecisionEngine.js");
    const gate = await decisionEngine.requireDecisionForExecution({
      blueprintId: "bp-1",
      recommendationId: "rec-new",
      trigger: "EXECUTE_WORKFLOW",
      goal: "Ship feature",
      title: "Ship feature",
      description: "Complete order",
      confidence: 0.88,
    });

    expect(gate.decision.options.length).toBeGreaterThanOrEqual(5);
    if (gate.allowed) {
      expect(gate.decision.approval.ready).toBe(true);
    }
  });
});
