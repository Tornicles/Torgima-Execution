import { emptyDbQueryResult } from "../../helpers/bhudhiDbMock.js";
import { describe, it, expect, vi } from "vitest";
import { civilizationPolicy } from "../../../bhudhi/civilization/policy/CivilizationPolicy.js";
import { populationEngine } from "../../../bhudhi/civilization/population/PopulationEngine.js";
import { civilInstitutionEngine } from "../../../bhudhi/civilization/institutions/CivilInstitutionEngine.js";
import { ecosystemEngine } from "../../../bhudhi/civilization/ecosystems/EcosystemEngine.js";
import { civilEconomy } from "../../../bhudhi/civilization/economy/CivilEconomy.js";
import { evolutionEngine } from "../../../bhudhi/civilization/evolution/EvolutionEngine.js";
import { civilGovernance } from "../../../bhudhi/civilization/governance/CivilGovernance.js";
import { civilResilience } from "../../../bhudhi/civilization/resilience/CivilResilience.js";
import { longHorizonEngine } from "../../../bhudhi/civilization/evolution/LongHorizonEngine.js";
import { seededUnit } from "../../../bhudhi/civilization/lib/seededUnit.js";

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
    bhudhiCivilizations: {},
    bhudhiCivilizationStates: {},
    bhudhiCivilizationEvents: {},
    bhudhiCivilizationForecasts: {},
    bhudhiCivilizationMemory: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-00000000000c",
  seed: "civilization-deterministic-seed",
  teams: [{ id: "t1", members: 3 }],
  organizations: [{ id: "o1", alignment: 0.7 }],
  world: { markets: 5 },
  economy: { growth: 0.1 },
};

describe("BCIE — CivilizationPolicy", () => {
  it("rejects control humans and remove uncertainty", () => {
    const r = civilizationPolicy.validate({ ...baseInput, constraints: ["CONTROL_HUMANS"] });
    expect(r.allowed).toBe(false);
  });

  it("allows simulate forecast recommend", () => {
    const r = civilizationPolicy.validate({ ...baseInput, constraints: ["simulate", "forecast"] });
    expect(r.allowed).toBe(true);
  });
});

describe("BCIE — seededUnit", () => {
  it("is deterministic", () => {
    expect(seededUnit("x", "y")).toBe(seededUnit("x", "y"));
  });
});

describe("BCIE — PopulationEngine", () => {
  it("tracks growth trust participation capacity", () => {
    const p = populationEngine.track(baseInput, baseInput.seed);
    expect(p.populationHealth).toBeGreaterThan(0);
    expect(p.distribution.trust).toBeDefined();
  });
});

describe("BCIE — CivilInstitutionEngine", () => {
  it("returns institution effectiveness", () => {
    const i = civilInstitutionEngine.simulate(baseInput, baseInput.seed);
    expect(i.institutionEffectiveness).toBeGreaterThanOrEqual(0);
    expect(i.coordination).toBeLessThanOrEqual(1);
  });
});

describe("BCIE — EcosystemEngine", () => {
  it("models cooperation competition exchange dependency", () => {
    const e = ecosystemEngine.model(baseInput, baseInput.seed);
    expect(e.ecosystemHealth).toBeGreaterThanOrEqual(0);
    expect(e.systemRisk).toBeGreaterThanOrEqual(0);
  });
});

describe("BCIE — CivilEconomy", () => {
  it("tracks production and trajectory", () => {
    const econ = civilEconomy.track(baseInput, baseInput.seed);
    expect(econ.production).toBeGreaterThan(0);
    expect(["growth", "stable", "decline", "compound", "collapse"]).toContain(econ.economicTrajectory);
  });
});

describe("BCIE — EvolutionEngine", () => {
  it("assigns evolution mode", () => {
    const ev = evolutionEngine.track(baseInput, baseInput.seed, 0.6);
    expect(["stable", "expanding", "fragile", "collapsing"]).toContain(ev.mode);
    expect(ev.survival).toBeGreaterThan(0);
  });
});

describe("BCIE — CivilGovernance", () => {
  it("observes without controlling", () => {
    const g = civilGovernance.observe(baseInput, baseInput.seed);
    expect(["recommend", "stress", "compare", "measure"]).toContain(g.action);
  });
});

describe("BCIE — CivilResilience", () => {
  it("measures shock adaptation recovery continuity", () => {
    const r = civilResilience.measure(baseInput.seed, 0.6, 0.5, 0.7);
    expect(r.resilienceScore).toBeLessThanOrEqual(100);
    expect(r.recoveryProfile.continuity).toBeDefined();
    expect(r.stressTests?.length).toBe(5);
    expect(r.recoveryTimeYears).toBeGreaterThanOrEqual(0);
    expect(r.antifragilityScore).toBeGreaterThan(0);
  });
});

describe("BCIE — LongHorizonEngine", () => {
  it("forecasts 1 5 10 25 100 year horizons", () => {
    const f = longHorizonEngine.forecast(baseInput.seed, "stable", 0.6);
    expect(f.horizons).toHaveLength(5);
    expect(f.horizons.map((h) => h.horizonYears)).toEqual([1, 5, 10, 25, 100]);
    expect(f.confidence).toBeLessThanOrEqual(0.85);
  });

  it("findInflectionPoints detects trajectory changes", () => {
    const series = [
      { year: 0, trajectory: "stable" as const, population: 1, institutions: 1, economicOutput: 1, ecosystem: 0.5, resilience: 0.5, momentum: "stable" as const },
      { year: 1, trajectory: "decline" as const, population: 1, institutions: 1, economicOutput: 1, ecosystem: 0.5, resilience: 0.5, momentum: "declining" as const },
    ];
    const points = longHorizonEngine.findInflectionPoints(series);
    expect(points).toHaveLength(1);
    expect(points[0].from).toBe("stable");
    expect(points[0].to).toBe("decline");
  });
});

describe("BCIE — CivilizationEngine", () => {
  it("runs full observe-structure-evolve cycle", async () => {
    const { civilizationEngine } = await import(
      "../../../bhudhi/civilization/civilization-engine/CivilizationEngine.js"
    );
    const out = await civilizationEngine.create(baseInput);
    expect(out.civilizationState.phase).toBeTruthy();
    expect(out.resilience).toBeGreaterThanOrEqual(0);
    expect(out.forecast?.horizons.length).toBe(5);
    expect(out.recommendation.startsWith("Advisory:")).toBe(true);
  });

  it("is deterministic when seeded", async () => {
    const { civilizationEngine } = await import(
      "../../../bhudhi/civilization/civilization-engine/CivilizationEngine.js"
    );
    const a = await civilizationEngine.simulate({ ...baseInput, seed: "fixed-civ" });
    const b = await civilizationEngine.simulate({ ...baseInput, seed: "fixed-civ" });
    expect(a.resilience).toBe(b.resilience);
    expect(a.evolutionMode).toBe(b.evolutionMode);
  });

  it("forecast returns long horizon result", async () => {
    const { civilizationEngine } = await import(
      "../../../bhudhi/civilization/civilization-engine/CivilizationEngine.js"
    );
    const forecast = await civilizationEngine.forecast(baseInput);
    expect(forecast.horizons.length).toBe(5);
  });

  it("validateBeforeDecision allows stable civilizations", async () => {
    const { civilizationEngine } = await import(
      "../../../bhudhi/civilization/civilization-engine/CivilizationEngine.js"
    );
    const gate = await civilizationEngine.validateBeforeDecision(baseInput);
    expect(typeof gate.allowed).toBe("boolean");
  });

  it("simulateYears returns yearly series", async () => {
    const { civilizationEngine } = await import(
      "../../../bhudhi/civilization/civilization-engine/CivilizationEngine.js"
    );
    const series = await civilizationEngine.simulateYears(baseInput, 5);
    expect(series).toHaveLength(5);
    expect(series[0].year).toBe(0);
    expect(series[4].trajectory).toBeTruthy();
  });

  it("inflectionPoints detects trajectory shifts", async () => {
    const { civilizationEngine } = await import(
      "../../../bhudhi/civilization/civilization-engine/CivilizationEngine.js"
    );
    const points = await civilizationEngine.inflectionPoints(baseInput, 10);
    expect(Array.isArray(points)).toBe(true);
  });
});

describe("BCIE — API catalog (Prompt 29)", () => {
  it("registers civilization routes", async () => {
    const { BHUDHI_API_ROUTES } = await import("../../../bhudhi/api/BhudhiCatalogService.js");
    const paths = BHUDHI_API_ROUTES.map((r) => r.path);
    expect(paths).toContain("/api/bhudhi/civilizations");
    expect(paths).toContain("/api/bhudhi/civilization/simulate-years");
    expect(paths).toContain("/api/bhudhi/civilization/resilience");
  });
});
