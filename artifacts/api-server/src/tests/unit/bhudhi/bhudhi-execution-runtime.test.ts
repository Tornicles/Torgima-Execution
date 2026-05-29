import { emptyDbQueryResult } from "../../helpers/bhudhiDbMock.js";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { TEST_BLUEPRINT_ID } = vi.hoisted(() => ({
  TEST_BLUEPRINT_ID: "00000000-0000-4000-8000-000000000035",
}));

const contextsStore: Array<Record<string, unknown>> = [];
const stepsStore: Array<Record<string, unknown>> = [];
const feedbackStore: Array<Record<string, unknown>> = [];
const resultsStore: Array<Record<string, unknown>> = [];

vi.mock("@workspace/db", () => {
  const T = {
    contexts: Symbol("contexts"),
    steps: Symbol("steps"),
    feedback: Symbol("feedback"),
    results: Symbol("results"),
  };

  function emptyQueryResult(data: unknown[] = []) {
    const promise = Promise.resolve(data) as Promise<unknown[]> & {
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    };
    promise.orderBy = vi.fn(() => ({ limit: vi.fn().mockResolvedValue(data) }));
    promise.limit = vi.fn().mockResolvedValue(data);
    return promise;
  }

  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          if (vals.execution_type) {
            const row = {
              id: `ctx-${contextsStore.length}`,
              sent_at: new Date(),
              started_at: new Date(),
              completed_at: null,
              progress: vals.progress ?? 0,
              output: {},
              feedback: {},
              errors: [],
              warnings: [],
              ...vals,
            };
            contextsStore.push(row);
            return { returning: vi.fn().mockResolvedValue([row]) };
          }
          if (vals.step_number !== undefined) {
            const row = { id: `step-${stepsStore.length}`, status: "pending", ...vals };
            stepsStore.push(row);
            return { returning: vi.fn().mockResolvedValue([row]) };
          }
          if (vals.feedback_type) {
            feedbackStore.push({ id: `fb-${feedbackStore.length}`, ...vals });
            return { returning: vi.fn().mockResolvedValue([{ id: "fb-1" }]) };
          }
          if (vals.success !== undefined) {
            resultsStore.push({ id: `res-${resultsStore.length}`, ...vals });
            return {
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([vals]),
              })),
              returning: vi.fn().mockResolvedValue([vals]),
            };
          }
          return { returning: vi.fn().mockResolvedValue([]) };
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn((table: symbol) => ({
          where: vi.fn(() => {
            if (table === T.contexts) return emptyQueryResult([...contextsStore]);
            if (table === T.steps) return emptyQueryResult([...stepsStore]);
            if (table === T.results) return emptyQueryResult([...resultsStore]);
            return emptyQueryResult([]);
          }),
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockImplementation(() => {
              if (table === T.contexts) {
                return Promise.resolve([...contextsStore].reverse());
              }
              return Promise.resolve([]);
            }),
          })),
          limit: vi.fn().mockImplementation(() => {
            if (table === T.steps && stepsStore.length) {
              return Promise.resolve([stepsStore[stepsStore.length - 1]]);
            }
            if (table === T.contexts && contextsStore.length) {
              return Promise.resolve([contextsStore[contextsStore.length - 1]]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: Record<string, unknown>) => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockImplementation(() => {
              const last = stepsStore[stepsStore.length - 1] ?? contextsStore[contextsStore.length - 1];
              if (last) Object.assign(last, vals);
              return Promise.resolve(last ? [last] : []);
            }),
          })),
        })),
      })),
    },
    bhudhiUnifiedExecutionContexts: T.contexts,
    bhudhiUnifiedExecutionSteps: T.steps,
    bhudhiUnifiedExecutionFeedback: T.feedback,
    bhudhiUnifiedExecutionResults: T.results,
  };
});

vi.mock("../../../bhudhi/operating/OperatingService.js", () => ({
  operatingService: {
    executeRecommendation: vi.fn().mockResolvedValue({ success: true }),
  },
}));
vi.mock("../../../bhudhi/erector/execution/SimulationExecution.js", () => ({
  simulationExecution: {
    run: vi.fn().mockReturnValue({
      events: [],
      history: [],
      pressure: 0.2,
      survived: true,
    }),
  },
}));
vi.mock("../../../bhudhi/teams/execution/TeamExecution.js", () => ({
  teamExecution: {
    manage: vi.fn().mockReturnValue({ velocity: 0.8, blockers: [], completion: 1 }),
  },
}));
vi.mock("../../../bhudhi/organization/execution/ExecutionCoordinator.js", () => ({
  executionCoordinator: {
    coordinate: vi.fn().mockReturnValue({ owners: [], blocked: [], actions: ["accelerate"] }),
  },
}));

describe("BHUDHI PROMPT 35 — ExecutionRuntime", () => {
  beforeEach(() => {
    contextsStore.length = 0;
    stepsStore.length = 0;
    feedbackStore.length = 0;
    resultsStore.length = 0;
  });

  it("starts and completes execution context", async () => {
    const { ExecutionRuntime } = await import("../../../bhudhi/runtime/ExecutionRuntime.js");
    const runtime = new ExecutionRuntime();
    const id = await runtime.start({
      blueprintId: TEST_BLUEPRINT_ID,
      executionType: "task",
      action: "Test task",
      payload: { title: "Ship" },
    });
    expect(id).toMatch(/^exec_/);
    const done = await runtime.complete(id, true, "Done", { ok: true });
    expect(done.success).toBe(true);
  });

  it("returns execution stats", async () => {
    const { ExecutionRuntime } = await import("../../../bhudhi/runtime/ExecutionRuntime.js");
    const runtime = new ExecutionRuntime();
    const id = await runtime.start({
      blueprintId: TEST_BLUEPRINT_ID,
      executionType: "task",
      action: "Stats test",
      payload: {},
    });
    await runtime.complete(id, true, "ok", {});
    const stats = await runtime.getStats(TEST_BLUEPRINT_ID);
    expect(stats.total).toBeGreaterThanOrEqual(1);
  });
});

describe("BHUDHI PROMPT 35 — UnifiedExecutor", () => {
  beforeEach(() => {
    contextsStore.length = 0;
    stepsStore.length = 0;
    resultsStore.length = 0;
    vi.clearAllMocks();
  });

  it("routes task execution", async () => {
    const { UnifiedExecutor } = await import("../../../bhudhi/runtime/executors/UnifiedExecutor.js");
    const executor = new UnifiedExecutor();
    const result = await executor.execute(TEST_BLUEPRINT_ID, "task", { title: "Draft order" });
    expect(result.success).toBe(true);
    expect(result.executionId).toBeTruthy();
  });

  it("routes simulation execution", async () => {
    const { UnifiedExecutor } = await import("../../../bhudhi/runtime/executors/UnifiedExecutor.js");
    const executor = new UnifiedExecutor();
    const result = await executor.execute(TEST_BLUEPRINT_ID, "simulation", {
      name: "Growth",
      iterations: 3,
    });
    expect(result.success).toBe(true);
  });

  it("routes team coordination", async () => {
    const { UnifiedExecutor } = await import("../../../bhudhi/runtime/executors/UnifiedExecutor.js");
    const executor = new UnifiedExecutor();
    const result = await executor.execute(TEST_BLUEPRINT_ID, "team", {
      name: "Alpha",
      members: [{ userId: "u1" }],
    });
    expect(result.success).toBe(true);
  });

  it("routes organization orchestration", async () => {
    const { UnifiedExecutor } = await import("../../../bhudhi/runtime/executors/UnifiedExecutor.js");
    const executor = new UnifiedExecutor();
    const result = await executor.execute(TEST_BLUEPRINT_ID, "organization", {
      name: "Org",
      projects: [{ id: "p1", name: "P1", ownerId: "u1" }],
    });
    expect(result.success).toBe(true);
  });
});
