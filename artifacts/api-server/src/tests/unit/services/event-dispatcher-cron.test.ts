import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventStatus } from "@workspace/state-machine";
import { EventTypes } from "../../../types/eventContracts.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

const mockTaskQueueSend = vi.fn().mockResolvedValue(undefined);
const mockDbUpdate = vi.fn().mockImplementation(() => ({
  set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
    updateCalls.push(values);
    return { where: vi.fn().mockResolvedValue(undefined) };
  }),
}));
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ catch: vi.fn() }) });
const mockSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  for: vi.fn(),
};

let claimedEvents: Array<Record<string, unknown>> = [];
let updateCalls: Array<Record<string, unknown>> = [];

vi.mock("../../../services/DeadLetterQueue.js", () => ({
  deadLetterQueue: {
    createFromFailedEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@workspace/db", () => {
  const txSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation((n: number) => ({
      for: vi.fn().mockResolvedValue(claimedEvents.slice(0, n)),
    })),
  };

  return {
    events: { id: "id", status: "status", process_after: "process_after", created_at: "created_at" },
    eventLogs: { id: "id", event_id: "event_id", result: "result" },
    db: {
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn().mockReturnValue(txSelectChain),
          update: vi.fn().mockImplementation(() => ({
            set: vi.fn().mockImplementation((values: Record<string, unknown>) => ({
              where: vi.fn().mockImplementation(async () => {
                updateCalls.push(values);
              }),
            })),
          })),
        };
        return fn(tx);
      }),
      select: vi.fn().mockReturnValue(mockSelectChain),
      update: mockDbUpdate,
      insert: mockInsert,
    },
    pool: { query: vi.fn() },
  };
});

describe("EventDispatcher cron subrequest-safe processing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    claimedEvents = [];
    updateCalls = [];
    mockTaskQueueSend.mockClear();
    mockTaskQueueSend.mockResolvedValue(undefined);
    globalThis.__TORGIMA_TASK_QUEUE__ = undefined;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.__TORGIMA_TASK_QUEUE__ = undefined;
  });

  it("uses dispatchPendingEventsForCron in worker handler (no multi-event loop)", () => {
    const worker = readRepo("artifacts/api-server/src/workers/EventDispatcherWorker.ts");
    expect(worker).toContain("dispatchPendingEventsForCron");
    expect(worker).not.toContain("MAX_EVENTS_PER_CRON_TICK = 5");
    expect(worker).not.toMatch(/for \(const _job of jobs\)/);
    expect(worker).not.toMatch(/eventsDispatched/);
    expect(worker).not.toContain('logContext: "cron"');
  });

  it("routes * * * * * to subrequest-safe cron path without handler.js", () => {
    const cron = readRepo("artifacts/api-server/src/schedulers/cloudflare-cron.ts");
    expect(cron).toContain("runEventDispatchPollSafe");
    expect(cron).toContain("EVENT_DISPATCH_POLL_QUEUE");
    expect(cron).toContain("isEventDispatchCronEnabled");
    expect(cron).toContain("subrequest-safe");
  });

  it("exports cron limits and kill-switch helpers", () => {
    const dispatcher = readRepo("artifacts/api-server/src/services/EventDispatcher.ts");
    expect(dispatcher).toContain("MAX_EVENTS_PER_CRON = 5");
    expect(dispatcher).toContain("MAX_SUBREQUESTS_PER_CRON_SAFE_LIMIT = 10");
    expect(dispatcher).toContain("MAX_PROCESSING_MS = 5_000");
    expect(dispatcher).toContain("isEventDispatchCronEnabled");
    expect(dispatcher).toContain("dispatchPendingEventsForCron");
  });

  it("defaults EVENT_DISPATCH_CRON_ENABLED to false", async () => {
    delete process.env.EVENT_DISPATCH_CRON_ENABLED;
    const { isEventDispatchCronEnabled } = await import("../../../services/EventDispatcher.js");
    expect(isEventDispatchCronEnabled()).toBe(false);
  });

  it("exits when EVENT_DISPATCH_CRON_ENABLED is off", async () => {
    vi.stubEnv("EVENT_DISPATCH_CRON_ENABLED", "false");
    const { dispatchPendingEventsForCron } = await import("../../../services/EventDispatcher.js");
    const dispatched = await dispatchPendingEventsForCron();
    expect(dispatched).toBe(0);
    expect(mockTaskQueueSend).not.toHaveBeenCalled();
  });

  it("returns ok when no pending events", async () => {
    vi.stubEnv("EVENT_DISPATCH_CRON_ENABLED", "true");
    globalThis.__TORGIMA_TASK_QUEUE__ = { send: mockTaskQueueSend } as never;
    claimedEvents = [];
    const { dispatchPendingEventsForCron } = await import("../../../services/EventDispatcher.js");
    const dispatched = await dispatchPendingEventsForCron();
    expect(dispatched).toBe(0);
    expect(mockTaskQueueSend).not.toHaveBeenCalled();
  });

  it("claims and enqueues up to batch size per cron tick", async () => {
    vi.stubEnv("EVENT_DISPATCH_CRON_ENABLED", "true");
    globalThis.__TORGIMA_TASK_QUEUE__ = { send: mockTaskQueueSend } as never;
    claimedEvents = [
      {
        id: "evt-1",
        event_type: EventTypes.FEEDBACK_SUBMITTED,
        entity_type: "feedback",
        entity_id: "ent-1",
        user_id: "user-1",
        blueprint_id: "bp-1",
        payload: {},
        idempotency_key: null,
        retry_count: 0,
        created_at: new Date(),
      },
      {
        id: "evt-2",
        event_type: EventTypes.TASK_GENERATION_REQUESTED,
        entity_type: "task",
        entity_id: "ent-2",
        user_id: "user-1",
        blueprint_id: "bp-1",
        payload: {},
        idempotency_key: null,
        retry_count: 0,
        created_at: new Date(),
      },
    ];

    const { dispatchPendingEventsForCron } = await import("../../../services/EventDispatcher.js");
    const dispatched = await dispatchPendingEventsForCron();

    expect(dispatched).toBe(2);
    expect(mockTaskQueueSend).toHaveBeenCalledTimes(2);
  });

  it("skips inline workers when TASK_QUEUE is missing and releases claim", async () => {
    vi.stubEnv("EVENT_DISPATCH_CRON_ENABLED", "true");
    claimedEvents = [
      {
        id: "evt-skip",
        event_type: EventTypes.FEEDBACK_SUBMITTED,
        entity_type: "feedback",
        entity_id: "ent-1",
        user_id: "user-1",
        blueprint_id: "bp-1",
        payload: {},
        idempotency_key: null,
        retry_count: 0,
        created_at: new Date(),
      },
    ];

    const { dispatchPendingEventsForCron } = await import("../../../services/EventDispatcher.js");
    const dispatched = await dispatchPendingEventsForCron();

    expect(dispatched).toBe(0);
    expect(mockTaskQueueSend).not.toHaveBeenCalled();
    expect(updateCalls.some((c) => c.status === EventStatus.RETRY_PENDING)).toBe(true);
  });

  it("marks failed enqueue as retry_pending before max attempts", async () => {
    vi.stubEnv("EVENT_DISPATCH_CRON_ENABLED", "true");
    mockTaskQueueSend.mockRejectedValueOnce(new Error("queue unavailable"));
    globalThis.__TORGIMA_TASK_QUEUE__ = { send: mockTaskQueueSend } as never;
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockResolvedValue([]);

    claimedEvents = [
      {
        id: "evt-fail",
        event_type: EventTypes.FEEDBACK_SUBMITTED,
        entity_type: "feedback",
        entity_id: "ent-1",
        user_id: "user-1",
        blueprint_id: "bp-1",
        payload: {},
        idempotency_key: null,
        retry_count: 1,
        created_at: new Date(),
      },
    ];

    const { dispatchPendingEventsForCron } = await import("../../../services/EventDispatcher.js");
    const dispatched = await dispatchPendingEventsForCron();

    expect(dispatched).toBe(0);
    expect(updateCalls.some((c) => c.status === EventStatus.RETRY_PENDING)).toBe(true);
  });

  it("sets wrangler cron env for production", () => {
    const wrangler = readRepo("artifacts/api-server/wrangler.toml");
    expect(wrangler).toContain('EVENT_DISPATCH_CRON_BATCH_SIZE = "5"');
    expect(wrangler).toContain('EVENT_DISPATCH_CRON_ENABLED = "true"');
  });
});
