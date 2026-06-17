import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Event loop repair (Prompt 4)", () => {
  it("scopes worker idempotency to worker name (not EventDispatcher enqueue log)", () => {
    const handler = readRepo("artifacts/api-server/src/workers/BaseWorkerHandler.ts");
    expect(handler).toContain('eq(eventLogs.worker, workerName)');
  });

  it("does not pre-log dispatcher enqueue as worker success", () => {
    const dispatcher = readRepo("artifacts/api-server/src/services/EventDispatcher.ts");
    expect(dispatcher).not.toContain('worker: "EventDispatcher",\n        result: "success"');
  });

  it("uses inline queue dispatch in test mode", () => {
    const queue = readRepo("artifacts/api-server/src/lib/queue.ts");
    expect(queue).toContain("shouldUseInlineQueueDispatch");
    expect(queue).toContain("WORKERS_TEST_MODE");
  });

  it("allows event dispatch cron in launch mode", () => {
    const cron = readRepo("artifacts/api-server/src/schedulers/cloudflare-cron.ts");
    expect(cron).toContain("isNonCriticalCronInLaunchMode");
    expect(cron).not.toContain("all background crons are disabled");
  });

  it("exports drainEventsForTest helper", () => {
    const processor = readRepo("artifacts/api-server/src/services/EventLoopProcessor.ts");
    expect(processor).toContain("drainEventsForTest");
    expect(processor).toContain("drainEventsOnce");
  });

  it("registers debug event-loop endpoints", () => {
    const debug = readRepo("artifacts/api-server/src/routes/debug.ts");
    expect(debug).toContain("/debug/event-loop");
    expect(debug).toContain("/debug/event-loop/drain-once");
  });

  it("defaults cron batch size to 5", () => {
    const dispatcher = readRepo("artifacts/api-server/src/services/EventDispatcher.ts");
    expect(dispatcher).toContain("EVENT_DISPATCH_BATCH_SIZE_DEFAULT = 5");
    expect(dispatcher).toContain("MAX_EVENTS_PER_CRON = 5");
  });

  it("marks signal_calculated with core_execution_loop for Erector bridge", () => {
    const signal = readRepo("artifacts/api-server/src/engines/signal/SignalCalculationEngine.ts");
    expect(signal).toContain("core_execution_loop: true");
  });

  it("Erector bridge bypasses contract gate for core execution loop", () => {
    const bridge = readRepo("artifacts/api-server/src/workers/erector-signal-bridge-worker.ts");
    expect(bridge).toContain("core_execution_loop");
  });
});
