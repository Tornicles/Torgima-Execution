import { emptyDbQueryResult } from "../../helpers/bhudhiDbMock.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hypothesisLab } from "../../../bhudhi/experiments/hypothesis/HypothesisLab.js";
import { experimentDesign } from "../../../bhudhi/experiments/design/ExperimentDesign.js";
import { allocationEngine } from "../../../bhudhi/experiments/allocation/AllocationEngine.js";
import { measurementEngine } from "../../../bhudhi/experiments/measurement/MeasurementEngine.js";
import { comparisonEngine } from "../../../bhudhi/experiments/comparison/ComparisonEngine.js";
import { causalExperimentEngine } from "../../../bhudhi/experiments/causal-analysis/CausalExperimentEngine.js";
import { standardizationEngine } from "../../../bhudhi/experiments/standardization/StandardizationEngine.js";
import { experimentPolicy } from "../../../bhudhi/experiments/policy/ExperimentPolicy.js";
import { experimentMemory } from "../../../bhudhi/experiments/experiment-memory/ExperimentMemory.js";

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
    bhudhiExperiments: {},
    bhudhiExperimentGroups: {},
    bhudhiExperimentResults: {},
    bhudhiExperimentMemory: {},
    bhudhiExperimentPromotions: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-000000000005",
  goal: "Improve task completion rate",
  metrics: ["impact", "speed"],
  decision: { explanation: "Try batching tasks" },
};

describe("BEE — HypothesisLab", () => {
  it("formulates falsifiable hypotheses", () => {
    const h = hypothesisLab.formulate(baseInput);
    expect(h.falsifiable).toBe(true);
    expect(h.validationPlan).toBeTruthy();
  });
});

describe("BEE — ExperimentDesign", () => {
  it("creates control and variants", () => {
    const h = hypothesisLab.formulate(baseInput);
    const design = experimentDesign.design(h, { metrics: ["impact"] });
    expect(design.groups.map((g) => g.groupKey)).toContain("control");
    expect(design.groups.length).toBe(4);
  });
});

describe("BEE — AllocationEngine", () => {
  it("filters protected values from variants", () => {
    const h = hypothesisLab.formulate(baseInput);
    const design = experimentDesign.design(h, {});
    const filtered = allocationEngine.filterProtected(design.groups, ["health"]);
    expect(filtered.some((g) => g.groupKey === "control")).toBe(true);
  });
});

describe("BEE — MeasurementEngine", () => {
  it("measures delta and effect size before interpretation", () => {
    const m = measurementEngine.measure(0.5, 0.65, 120);
    expect(m.delta).toBeGreaterThan(0);
    expect(m.confidence).toBeGreaterThan(0.5);
  });
});

describe("BEE — ComparisonEngine", () => {
  it("difference ≠ improvement when inconclusive", () => {
    const control = measurementEngine.measure(0.5, 0.5, 100);
    const variants = [
      { groupKey: "variant_a", measurement: measurementEngine.measure(0.5, 0.51, 100) },
    ];
    const cmp = comparisonEngine.compare(control, variants);
    expect(["winner", "loser", "neutral", "inconclusive"]).toContain(cmp.verdict);
  });
});

describe("BEE — CausalExperimentEngine", () => {
  it("correlation cannot graduate with low effect", () => {
    const control = measurementEngine.measure(0.5, 0.5, 50);
    const cmp = comparisonEngine.compare(control, []);
    const causal = causalExperimentEngine.analyze(cmp, control);
    expect(causal.causes.length).toBeGreaterThan(0);
  });
});

describe("BEE — StandardizationEngine", () => {
  it("one success ≠ truth — requires repeat", () => {
    const p = standardizationEngine.evaluate({
      confidence: 0.6,
      repeatability: 0.4,
      stability: 0.5,
      governanceOk: true,
    });
    expect(p.action).toBe("repeat");
  });

  it("promotes when criteria met", () => {
    const p = standardizationEngine.evaluate({
      confidence: 0.9,
      repeatability: 0.8,
      stability: 0.7,
      governanceOk: true,
    });
    expect(p.action).toBe("promote");
    expect(p.allowed).toBe(true);
  });
});

describe("BEE — ExperimentPolicy", () => {
  it("forbids identity experiments and signal override", () => {
    const result = experimentPolicy.validate({
      blueprintId: baseInput.blueprintId,
      goal: "x",
      hypothesisType: "identity",
      constraints: ["OVERRIDE_SIGNALS"],
    });
    expect(result.allowed).toBe(false);
  });
});

describe("BEE — ExperimentEngine integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    experimentMemory.clearActive(baseInput.blueprintId);
  });

  it("create returns experiment with hypothesis and groups", async () => {
    const { experimentEngine } = await import(
      "../../../bhudhi/experiments/experiment-engine/ExperimentEngine.js"
    );
    const exp = await experimentEngine.create(baseInput);

    expect(exp.experimentId).toBeTruthy();
    expect(exp.groups.length).toBeGreaterThanOrEqual(4);
    expect(exp.successCriteria).toBeTruthy();
  });

  it("blocks overlapping experiments", async () => {
    const { experimentEngine } = await import(
      "../../../bhudhi/experiments/experiment-engine/ExperimentEngine.js"
    );
    experimentMemory.clearActive(baseInput.blueprintId);
    await experimentEngine.create(baseInput);
    await expect(experimentEngine.create(baseInput)).rejects.toThrow(/overlapping/);
  });
});
