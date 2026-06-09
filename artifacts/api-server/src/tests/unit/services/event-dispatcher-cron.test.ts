import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventStatus } from "@workspace/state-machine";
import { EventTypes } from "../../../types/eventContracts.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

const mockSend = vi.fn().mockResolvedValue("job-1");
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

vi.mock("../../../lib/queue.js", () => ({
  getBoss: vi.fn().mockResolvedValue({ send: mockSend }),
}));

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

describe("EventDispatcher cron single-item processing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    claimedEvents = [];
    updateCalls = [];
    mockSend.mockClear();
    mockSend.mockResolvedValue("job-1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("caps cron worker to one event per invocation (no multi-event loop)", () => {
    const worker = readRepo("artifacts/api-server/src/workers/EventDispatcherWorker.ts");
    expect(worker).toContain("getCronDispatchBatchSize");
    expect(worker).not.toContain("MAX_EVENTS_PER_CRON_TICK = 5");
    expect(worker).not.toMatch(/for \(const _job of jobs\)/);
    expect(worker).not.toMatch(/eventsDispatched/);
    expect(worker).toContain('logContext: "cron"');
  });

  it("uses FOR UPDATE SKIP LOCKED and hard cron limits in EventDispatcher", () => {
    const dispatcher = readRepo("artifacts/api-server/src/services/EventDispatcher.ts");
    expect(dispatcher).toContain('export const MAX_EVENTS_PER_CRON = 1');
    expect(dispatcher).toContain("MAX_PROCESSING_MS = 5_000");
    expect(dispatcher).toContain("MAX_DISPATCH_ATTEMPTS = 3");
    expect(dispatcher).toContain('for("update", { skipLocked: true })');
    expect(dispatcher).toContain("EVENT_DISPATCH_CRON_BATCH_SIZE");
  });

  it("defaults EVENT_DISPATCH_CRON_BATCH_SIZE to 1 on Cloudflare", async () => {
    vi.stubEnv("TORGIMA_RUNTIME", "cloudflare");
    delete process.env.EVENT_DISPATCH_CRON_BATCH_SIZE;
    const { getCronDispatchBatchSize, MAX_EVENTS_PER_CRON } = await import(
      "../../../services/EventDispatcher.js"
    );
    expect(getCronDispatchBatchSize()).toBe(MAX_EVENTS_PER_CRON);
    expect(getCronDispatchBatchSize()).toBe(1);
  });

  it("never exceeds MAX_EVENTS_PER_CRON even when env requests more", async () => {
    vi.stubEnv("EVENT_DISPATCH_CRON_BATCH_SIZE", "10");
    const { getCronDispatchBatchSize, MAX_EVENTS_PER_CRON } = await import(
      "../../../services/EventDispatcher.js"
    );
    expect(getCronDispatchBatchSize()).toBe(MAX_EVENTS_PER_CRON);
  });

  it("processes at most one claimed event per cron dispatch call", async () => {
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

    const { dispatchPendingEvents, getCronDispatchBatchSize } = await import(
      "../../../services/EventDispatcher.js"
    );
    const dispatched = await dispatchPendingEvents(getCronDispatchBatchSize(), { logContext: "cron" });

    expect(dispatched).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("returns ok when no pending events", async () => {
    claimedEvents = [];
    const { dispatchPendingEvents, getCronDispatchBatchSize } = await import(
      "../../../services/EventDispatcher.js"
    );
    const dispatched = await dispatchPendingEvents(getCronDispatchBatchSize(), { logContext: "cron" });
    expect(dispatched).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("marks failed dispatch as retry_pending before max attempts", async () => {
    mockSend.mockRejectedValueOnce(new Error("queue unavailable"));
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

    const { dispatchPendingEvents, getCronDispatchBatchSize } = await import(
      "../../../services/EventDispatcher.js"
    );
    const dispatched = await dispatchPendingEvents(getCronDispatchBatchSize(), { logContext: "cron" });

    expect(dispatched).toBe(0);
    expect(updateCalls.some((c) => c.status === EventStatus.RETRY_PENDING)).toBe(true);
  });

  it("claims events inside a transaction with skip-locked select", async () => {
    const { db } = await import("@workspace/db");
    claimedEvents = [
      {
        id: "evt-claim",
        event_type: EventTypes.FEEDBACK_SUBMITTED,
        entity_type: "feedback",
        entity_id: null,
        user_id: null,
        blueprint_id: null,
        payload: {},
        idempotency_key: null,
        retry_count: 0,
        created_at: new Date(),
      },
    ];

    const { dispatchPendingEvents, getCronDispatchBatchSize } = await import(
      "../../../services/EventDispatcher.js"
    );
    await dispatchPendingEvents(getCronDispatchBatchSize(), { logContext: "cron" });

    expect(db.transaction).toHaveBeenCalled();
    expect(updateCalls.some((c) => c.status === EventStatus.CLAIMED)).toBe(true);
  });

  it("sets EVENT_DISPATCH_CRON_BATCH_SIZE=1 in wrangler production vars", () => {
    const wrangler = readRepo("artifacts/api-server/wrangler.toml");
    expect(wrangler).toContain('EVENT_DISPATCH_CRON_BATCH_SIZE = "1"');
  });

  it("logs cron started in cloudflare-cron bridge", () => {
    const cron = readRepo("artifacts/api-server/src/schedulers/cloudflare-cron.ts");
    expect(cron).toContain('[Cron] Started');
  });
});
