import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Cloudflare Workers runtime bridge", () => {
  it("maps wrangler cron triggers to queue producers", () => {
    const wrangler = readRepo("artifacts/api-server/wrangler.toml");
    const cronBridge = readRepo("artifacts/api-server/src/schedulers/cloudflare-cron.ts");

    expect(wrangler).toContain("0 2 * * *");
    expect(wrangler).toContain("*/30 * * * *");
    expect(wrangler).toContain("0 3 * * *");
    expect(wrangler).toContain("*/10 * * * *");
    expect(wrangler).toContain("* * * * *");

    expect(cronBridge).toContain('"0 2 * * *": SESSION_CLEANUP_QUEUE');
    expect(cronBridge).toContain('WorkerQueues.INACTIVITY_CRON');
    expect(cronBridge).toContain('WorkerQueues.PATTERN_DAILY_CRON');
    expect(cronBridge).toContain("STATE_INTEGRITY_QUEUE");
    expect(cronBridge).toContain("EVENT_DISPATCH_POLL_QUEUE");
  });

  it("exports scheduled handler on the Worker entry", () => {
    const worker = readRepo("artifacts/api-server/src/worker.ts");
    expect(worker).toContain("async scheduled(");
    expect(worker).toContain("handleCloudflareCron");
  });

  it("binds TORGIMA_SESSIONS KV namespace in wrangler", () => {
    const wrangler = readRepo("artifacts/api-server/wrangler.toml");
    expect(wrangler).toContain('binding = "SESSIONS"');
    expect(wrangler).not.toContain("REPLACE_WITH_TORGIMA_SESSIONS_KV_ID");
  });

  it("registers cron workers in the queue consumer", () => {
    const handler = readRepo("artifacts/api-server/src/queues/handler.ts");
    expect(handler).toContain("SessionCleanupWorker");
    expect(handler).toContain("InactivityWorker");
    expect(handler).toContain("PatternScanWorker");
    expect(handler).toContain("StateIntegrityWorker");
    expect(handler).toContain("EventDispatcherWorker");
  });
});
