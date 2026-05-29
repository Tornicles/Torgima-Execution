import { emptyDbQueryResult } from "../../helpers/bhudhiDbMock.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { entityGraph } from "../../../bhudhi/world/entity-engine/EntityGraph.js";
import { stateEngine } from "../../../bhudhi/world/state-engine/StateEngine.js";
import { relationshipEngine } from "../../../bhudhi/world/relationship-engine/RelationshipEngine.js";
import { causalityEngine } from "../../../bhudhi/world/causality/CausalityEngine.js";
import { timelineEngine } from "../../../bhudhi/world/timeline/TimelineEngine.js";
import { constraintEngine } from "../../../bhudhi/world/constraints/ConstraintEngine.js";
import { realitySync } from "../../../bhudhi/world/reality-sync/RealitySync.js";
import { counterfactualEngine } from "../../../bhudhi/world/counterfactual/CounterfactualEngine.js";
import { worldPrediction } from "../../../bhudhi/world/prediction/WorldPrediction.js";
import { worldPolicy } from "../../../bhudhi/world/policy/WorldPolicy.js";

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
          where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
      })),
    },
    bhudhiWorldEntities: {},
    bhudhiWorldStates: {},
    bhudhiWorldRelationships: {},
    bhudhiWorldEvents: {},
    bhudhiWorldSnapshots: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000099",
  trigger: "TASK_FEEDBACK",
  memory: "Order completed successfully",
  signals: { global: "power", confidence: 0.8 },
  blueprint: { title: "Launch MVP", phase: "execution" },
};

describe("BWME — EntityGraph", () => {
  it("builds connected entities — nothing exists isolated", () => {
    const entities = entityGraph.buildFromInput(baseInput);
    expect(entities.length).toBeGreaterThanOrEqual(5);
    const types = new Set(entities.map((e) => e.type));
    expect(types.has("GOAL")).toBe(true);
    expect(types.has("AGENT")).toBe(true);
    const withRels = entities.filter((e) => e.relationships.length > 0);
    expect(withRels.length).toBeGreaterThan(0);
  });
});

describe("BWME — StateEngine", () => {
  it("tracks before, after, delta", () => {
    const e = entityGraph.create("TASK", "Ship feature", { status: "pending" });
    const updated = stateEngine.transition(e, { status: "done" });
    const delta = stateEngine.computeDelta(e.state, updated.state);
    expect(delta.delta.status).toBeDefined();
    expect(delta.after.status).toBe("done");
  });
});

describe("BWME — RelationshipEngine", () => {
  it("infers relationships and propagates changes", () => {
    const entities = entityGraph.buildFromInput(baseInput);
    const rels = relationshipEngine.infer(entities);
    expect(rels.length).toBeGreaterThan(0);
    const goal = entities.find((e) => e.type === "GOAL")!;
    const affected = relationshipEngine.propagate(rels, goal.entityId);
    expect(affected.length).toBeGreaterThan(1);
  });
});

describe("BWME — CausalityEngine", () => {
  it("builds cause tree — correlation requires confidence", () => {
    const tree = causalityEngine.buildCauseTree(baseInput);
    expect(tree.cause).toContain("TASK_FEEDBACK");
    expect(tree.children?.length).toBeGreaterThan(0);
    const weak = causalityEngine.explain("Event", [], 0.9);
    expect(weak).toBeNull();
  });
});

describe("BWME — TimelineEngine", () => {
  it("commits snapshots and supports branch/replay", () => {
    const entities = entityGraph.buildFromInput(baseInput);
    const rels = relationshipEngine.infer(entities);
    const ws = {
      sessionId: "s1",
      version: 1,
      entities,
      relationships: rels,
      events: [],
      constraints: { allowed: true, blocked: [], why: "ok" },
      timeline: { past: 0, current: 1, future: 2 },
    };
    const snap = timelineEngine.commit(baseInput.blueprintId, ws);
    expect(snap.version).toBe(1);
    const replay = timelineEngine.replay(baseInput.blueprintId, 1);
    expect(replay?.entities.length).toBe(entities.length);
  });
});

describe("BWME — ConstraintEngine", () => {
  it("reality beats intention when danger signal", () => {
    const result = constraintEngine.evaluate({
      blueprintId: baseInput.blueprintId,
      signals: { global: "danger" },
    });
    expect(result.allowed).toBe(false);
    expect(result.blocked).toContain("execution");
  });
});

describe("BWME — RealitySync", () => {
  it("detects drift and conflicts", () => {
    const sync = realitySync.sync({
      blueprintId: baseInput.blueprintId,
      signals: { global: "danger" },
      feedback: { positive: true },
      simulation: {},
      execution: { status: "completed" },
    });
    expect(sync.sources.length).toBeGreaterThan(0);
    expect(sync.conflicts).toBeGreaterThan(0);
  });
});

describe("BWME — CounterfactualEngine", () => {
  it("generates alternate realities", () => {
    const scenarios = counterfactualEngine.generate("delay launch by 2 weeks");
    expect(scenarios.length).toBe(3);
    expect(scenarios[0]!.probability).toBeGreaterThan(scenarios[2]!.probability);
  });
});

describe("BWME — WorldPolicy", () => {
  it("forbids rewrite signals and invent state", () => {
    const result = worldPolicy.validate({
      blueprintId: baseInput.blueprintId,
      signals: { rewriteSignals: true },
      constraints: ["INVENT_STATE"],
    });
    expect(result.allowed).toBe(false);
  });
});

describe("BWME — WorldEngine integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sync returns worldState, confidence, changes", async () => {
    const { worldEngine } = await import("../../../bhudhi/world/world-engine/WorldEngine.js");
    const output = await worldEngine.sync(baseInput);

    expect(output.worldState.sessionId).toBeTruthy();
    expect(output.worldState.entities.length).toBeGreaterThanOrEqual(5);
    expect(output.confidence).toBeGreaterThan(0);
    expect(output.changes.length).toBeGreaterThan(0);
    expect(output.prediction?.next).toBeTruthy();
  });

  it("formatWorldContext answers what exists and what changed", async () => {
    const { worldEngine } = await import("../../../bhudhi/world/world-engine/WorldEngine.js");
    const output = await worldEngine.sync(baseInput);
    const ctx = worldEngine.formatWorldContext(output);
    expect(ctx).toContain("Entities:");
    expect(ctx).toContain("Changes:");
  });

  it("branch generates counterfactual scenarios", async () => {
    const { worldEngine } = await import("../../../bhudhi/world/world-engine/WorldEngine.js");
    await worldEngine.sync(baseInput);
    const branch = await worldEngine.branch(baseInput.blueprintId, "Skip validation phase");
    expect(branch.scenarios.length).toBe(3);
    expect(branch.whatWouldHappen).toBeTruthy();
  });
});
