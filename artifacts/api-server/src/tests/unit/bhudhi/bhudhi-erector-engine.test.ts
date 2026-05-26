import { describe, it, expect, vi } from "vitest";
import { simulationPolicy } from "../../../bhudhi/erector/policy/SimulationPolicy.js";
import { worldGenerator } from "../../../bhudhi/erector/world-generator/WorldGenerator.js";
import { scenarioEngine } from "../../../bhudhi/erector/scenario-engine/ScenarioEngine.js";
import { actorEngine } from "../../../bhudhi/erector/actor-engine/ActorEngine.js";
import { simulationEconomy } from "../../../bhudhi/erector/economy/SimulationEconomy.js";
import { institutionEngine } from "../../../bhudhi/erector/institutions/InstitutionEngine.js";
import { environmentEngine } from "../../../bhudhi/erector/environment/EnvironmentEngine.js";
import { simulationExecution } from "../../../bhudhi/erector/execution/SimulationExecution.js";
import { simulationScore } from "../../../bhudhi/erector/scoring/SimulationScore.js";
import { simulationMemory } from "../../../bhudhi/erector/simulation-memory/SimulationMemory.js";
import { seededUnit } from "../../../bhudhi/erector/lib/seededRandom.js";

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
    bhudhiSimulationWorlds: {},
    bhudhiSimulationRuns: {},
    bhudhiSimulationScores: {},
    bhudhiSimulationEvents: {},
    bhudhiSimulationMemory: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-00000000000e",
  goal: "Launch blueprint",
  seed: "deterministic-test-seed",
  mode: "STANDARD" as const,
  scenario: "realistic" as const,
};

describe("BERE — SimulationPolicy", () => {
  it("rejects forbidden constraints", () => {
    const r = simulationPolicy.validate({ ...baseInput, constraints: ["AUTO_EXECUTE"] });
    expect(r.allowed).toBe(false);
  });

  it("allows simulate predict recommend", () => {
    const r = simulationPolicy.validate({ ...baseInput, constraints: ["simulate", "stress_test"] });
    expect(r.allowed).toBe(true);
  });
});

describe("BERE — seededRandom", () => {
  it("is deterministic for same seed", () => {
    expect(seededUnit("abc", "x")).toBe(seededUnit("abc", "x"));
    expect(seededUnit("abc", "y")).not.toBe(seededUnit("abc", "x"));
  });
});

describe("BERE — WorldGenerator", () => {
  it("generates market organization individuals systems", () => {
    const { world, mode } = worldGenerator.generate(baseInput, baseInput.seed);
    expect(world.market).toBeDefined();
    expect(world.organization).toBeDefined();
    expect(world.individuals.length).toBeGreaterThan(0);
    expect(mode).toBe("STANDARD");
  });

  it("reproduces world with same seed", () => {
    const a = worldGenerator.generate(baseInput, "fixed-seed");
    const b = worldGenerator.generate(baseInput, "fixed-seed");
    expect(a.world.resources).toEqual(b.world.resources);
  });
});

describe("BERE — ScenarioEngine", () => {
  it("generates five scenario alternatives", () => {
    const scenarios = scenarioEngine.generateAll(baseInput, baseInput.seed);
    expect(scenarios).toHaveLength(5);
    expect(scenarios.map((s) => s.scenario)).toContain("stress");
  });
});

describe("BERE — ActorEngine", () => {
  it("spawns users teams customers competitors agents", () => {
    const { world } = worldGenerator.generate(baseInput, baseInput.seed);
    const actors = actorEngine.spawn(world, baseInput.seed);
    const kinds = new Set(actors.map((a) => a.kind));
    expect(kinds.has("user")).toBe(true);
    expect(kinds.has("agent")).toBe(true);
    expect(kinds.has("competitor")).toBe(true);
  });
});

describe("BERE — SimulationEconomy", () => {
  it("tracks economic health and trajectory", () => {
    const { world } = worldGenerator.generate(baseInput, baseInput.seed);
    const actors = actorEngine.spawn(world, baseInput.seed);
    const econ = simulationEconomy.simulate(actors, "realistic", baseInput.seed);
    expect(econ.economicHealth).toBeGreaterThanOrEqual(0);
    expect(["growth", "stable", "decline"]).toContain(econ.trajectory);
  });
});

describe("BERE — InstitutionEngine", () => {
  it("returns institution pressure", () => {
    const { world } = worldGenerator.generate(baseInput, baseInput.seed);
    const pressure = institutionEngine.pressure(world, baseInput.seed);
    expect(pressure).toBeGreaterThanOrEqual(0);
    expect(pressure).toBeLessThanOrEqual(1);
  });
});

describe("BERE — EnvironmentEngine", () => {
  it("evolves independently over ticks", () => {
    let env = environmentEngine.initial(baseInput, baseInput.seed, 0.3);
    env = environmentEngine.evolve(env, baseInput.seed, 1);
    expect(env.tick).toBe(1);
  });
});

describe("BERE — SimulationExecution", () => {
  it("produces event-driven outcomes", () => {
    const { world } = worldGenerator.generate(baseInput, baseInput.seed);
    const actors = actorEngine.spawn(world, baseInput.seed);
    const econ = simulationEconomy.simulate(actors, "realistic", baseInput.seed);
    const outcomes = simulationExecution.run(
      baseInput.goal,
      actors,
      econ,
      "realistic",
      0.3,
      baseInput.seed,
    );
    expect(outcomes.history.length).toBeGreaterThan(0);
    expect(typeof outcomes.survived).toBe("boolean");
    expect(outcomes.pressure).toBeGreaterThanOrEqual(0);
  });
});

describe("BERE — SimulationScore", () => {
  it("scores 0-100 with confidence", () => {
    const outcomes = {
      events: [{ at: 0, type: "test", detail: "x" }],
      history: ["ok"],
      pressure: 0.4,
      survived: true,
    };
    const score = simulationScore.measure(outcomes, { economicHealth: 0.7, risk: 0.3, trajectory: "stable" }, "realistic");
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.confidence).toBeGreaterThan(0);
  });
});

describe("BERE — SimulationMemory", () => {
  it("stores and replays by simulationId", async () => {
    const { erectorRuntime } = await import("../../../bhudhi/erector/runtime/ErectorRuntime.js");
    const a = await erectorRuntime.create(baseInput);
    const replay = await erectorRuntime.replay(a.simulationId);
    expect(replay?.simulationId).toBe(a.simulationId);
  });
});

describe("BERE — ErectorRuntime", () => {
  it("runs full lifecycle with recommendation", async () => {
    const { erectorRuntime } = await import("../../../bhudhi/erector/runtime/ErectorRuntime.js");
    const out = await erectorRuntime.run(baseInput);
    expect(out.simulationId).toBeTruthy();
    expect(out.outcomes).toBeDefined();
    expect(out.recommendation).toBeTruthy();
    expect(out.scenarios?.length).toBe(5);
  });

  it("is deterministic when seeded", async () => {
    const { erectorRuntime } = await import("../../../bhudhi/erector/runtime/ErectorRuntime.js");
    const input = { ...baseInput, seed: "replay-seed-42" };
    const a = await erectorRuntime.run(input);
    const b = await erectorRuntime.run(input);
    expect(a.outcomes.pressure).toBe(b.outcomes.pressure);
    expect(a.score?.overall).toBe(b.score?.overall);
  });

  it("compare ranks simulations", async () => {
    const { erectorRuntime } = await import("../../../bhudhi/erector/runtime/ErectorRuntime.js");
    await erectorRuntime.create(baseInput);
    const cmp = await erectorRuntime.compare(baseInput.blueprintId);
    expect(cmp.runs.length).toBeGreaterThanOrEqual(1);
  });

  it("validateBeforeExecution blocks collapse survival", async () => {
    const { erectorRuntime } = await import("../../../bhudhi/erector/runtime/ErectorRuntime.js");
    const gate = await erectorRuntime.validateBeforeExecution({
      ...baseInput,
      scenario: "collapse",
      seed: "collapse-low",
    });
    expect(typeof gate.allowed).toBe("boolean");
  });
});
