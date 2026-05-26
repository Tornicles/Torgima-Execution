import { describe, it, expect, vi, beforeEach } from "vitest";
import { benchScale } from "./benchScale.js";

const BP = "00000000-0000-4000-8000-00000000b038e";

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
              started_at: new Date(),
              completed_at: null,
              progress: vals.progress ?? 0,
              output: {},
              feedback: {},
              errors: [],
              warnings: [],
              created_at: new Date(),
              updated_at: new Date(),
              ...vals,
            };
            contextsStore.push(row);
            return { returning: vi.fn().mockResolvedValue([row]) };
          }
          if (vals.step_number !== undefined) {
            stepsStore.push({ id: `step-${stepsStore.length}`, status: "pending", ...vals });
            return { returning: vi.fn().mockResolvedValue([{ id: "s1" }]) };
          }
          if (vals.feedback_type) {
            feedbackStore.push(vals);
            return { returning: vi.fn().mockResolvedValue([{ id: "fb-1" }]) };
          }
          if (vals.success !== undefined) {
            resultsStore.push(vals);
            return {
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([vals]),
              })),
              returning: vi.fn().mockResolvedValue([vals]),
            };
          }
          return { returning: vi.fn().mockResolvedValue([{ id: "tl-1" }]) };
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn((table: symbol) => ({
          where: vi.fn(() => {
            if (table === T.contexts) {
              const last = contextsStore[contextsStore.length - 1];
              return {
                limit: vi.fn().mockResolvedValue(last ? [last] : []),
              };
            }
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
              const last = contextsStore[contextsStore.length - 1];
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

describe("BHUDHI Prompt 38 — Execution benchmarks", () => {
  beforeEach(() => {
    contextsStore.length = 0;
    stepsStore.length = 0;
    feedbackStore.length = 0;
    resultsStore.length = 0;
  });

  it("executes tasks with >95% success rate", async () => {
    const count = benchScale(100, 20);
    const { UnifiedExecutor } = await import("../../bhudhi/runtime/executors/UnifiedExecutor.js");
    const executor = new UnifiedExecutor();
    let ok = 0;
    for (let i = 0; i < count; i++) {
      try {
        const result = await executor.execute(BP, "task", { title: `Task ${i}`, status: "completed" });
        if (result.success) ok++;
      } catch {
        /* failure */
      }
    }
    expect((ok / count) * 100).toBeGreaterThan(95);
  });

  it("handles concurrent task executions", async () => {
    const concurrency = benchScale(100, 20);
    const { UnifiedExecutor } = await import("../../bhudhi/runtime/executors/UnifiedExecutor.js");
    const executor = new UnifiedExecutor();
    const start = Date.now();
    await Promise.all(
      Array.from({ length: concurrency }, (_, i) =>
        executor.execute(BP, "task", { title: `Concurrent ${i}` }),
      ),
    );
    expect(Date.now() - start).toBeLessThan(30_000);
  });
});
