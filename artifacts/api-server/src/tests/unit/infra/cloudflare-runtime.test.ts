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
    expect(worker).toContain("bindCloudflareEnv(env)");
  });

  it("binds TORGIMA_SESSIONS KV namespace in wrangler", () => {
    const wrangler = readRepo("artifacts/api-server/wrangler.toml");
    expect(wrangler).toContain('binding = "SESSIONS"');
    expect(wrangler).not.toContain("REPLACE_WITH_TORGIMA_SESSIONS_KV_ID");
  });

  it("documents secure Worker secret setup script", () => {
    const script = readRepo("scripts/setup-cloudflare-secrets.mjs");
    const pkg = readRepo("package.json");
    expect(pkg).toContain("cf:secrets:worker");
    expect(script).toContain("wrangler secret put");
    expect(script).toContain("DATABASE_URL");
    expect(script).toContain("input hidden");
    expect(script).not.toMatch(/writeFileSync|createWriteStream/);
  });

  it("exposes cloudflare-env diagnostic without leaking values", () => {
    const debug = readRepo("artifacts/api-server/src/routes/debug.ts");
    const runtime = readRepo("artifacts/api-server/src/lib/cloudflare-runtime.ts");
    expect(debug).toContain("/debug/cloudflare-env");
    expect(debug).toContain('router.use("/debug", withAuth("INTERNAL_SERVICE"))');
    expect(debug).toContain('"present"');
    expect(debug).toContain('"missing"');
    expect(debug).not.toContain("process.env.DATABASE_URL,");
    expect(runtime).toContain("bindCloudflareEnv");
    expect(runtime).toContain("DATABASE_URL");
    expect(runtime).toContain("RESEND_API_KEY");
  });

  it("CI deploy verifies Worker via workers.dev (bypasses zone WAF)", () => {
    const workflow = readRepo(".github/workflows/deploy-cloudflare.yml");
    expect(workflow).toContain("workers.dev");
    expect(workflow).toContain("GitHub-Actions-Deploy-Verify");
    expect(workflow).not.toContain("https://api.torgima.com/health");
    expect(workflow).not.toContain('API_BASE="https://api.torgima.com"');
    expect(workflow).toContain("/api/debug/db-target");
    expect(workflow).toContain("workers/scripts/torgima");
    expect(workflow).toContain("verify-connections");
    expect(workflow).toContain("verify:deploy:connections");
  });

  it("resolves empty WORKER_URL to workers.dev default in connection script", () => {
    const script = readRepo("scripts/verify-deploy-connections.mjs");
    expect(script).toContain("resolveWorkerUrl");
    expect(script).toContain("trimmed || DEFAULT_WORKER_URL");
    expect(script).not.toMatch(/WORKER_URL\s*\?\?/);
  });

  it("provisions WAF skip rule for health endpoints and GitHub Actions", () => {
    const script = readRepo("scripts/ensure-cloudflare-waf-ci-skip.mjs");
    const pkg = readRepo("package.json");
    expect(pkg).toContain("ensure:cloudflare:waf-ci-skip");
    expect(script).toContain("http_request_sbfm");
    expect(script).toContain("GitHub-Actions");
    expect(script).toContain("/api/health");
    expect(script).toContain('eq "/api/healthz"');
    expect(script).toContain("/api/debug/db-target");
    expect(script).not.toMatch(/uri\.path eq "\/healthz"/);
    expect(script).toContain('action: "skip"');
  });

  it("/api/health returns transparent per-check diagnostics", () => {
    const health = readRepo("artifacts/api-server/src/routes/health.ts");
    expect(health).toContain("runHealthCheck");
    expect(health).toContain("checks,");
    expect(health).toContain("failing");
    expect(health).toContain("HEALTH_CHECK_TIMEOUT_MS");
  });

  it("treats TASK_QUEUE as optional until wrangler producer binding is enabled", () => {
    const wrangler = readRepo("artifacts/api-server/wrangler.toml");
    const ensureScript = readRepo("scripts/ensure-cloudflare-queues.mjs");
    const queueAdapter = readRepo("artifacts/api-server/src/lib/cloudflare-queue.ts");
    const cronBridge = readRepo("artifacts/api-server/src/schedulers/cloudflare-cron.ts");

    expect(wrangler).toContain("# binding = \"TASK_QUEUE\"");
    expect(wrangler).toContain("torgima-task-queue");
    expect(ensureScript).toContain("workerRequiresQueueBinding");
    expect(ensureScript).toMatch(/invalid queue settings/i);
    expect(ensureScript).toContain("queue_name");
    expect(ensureScript).toContain("Queue provisioning skipped or already configured");
    expect(queueAdapter).toContain("No queue binding — run handler in-process");
    expect(cronBridge).toContain("Ran inline (no TASK_QUEUE binding)");
  });

  it("does not ship Railway or Vercel deploy configs", () => {
    expect(() => readRepo("artifacts/api-server/railway.json")).toThrow();
    expect(() => readRepo("vercel.json")).toThrow();
    expect(() => readRepo("artifacts/torgima/vercel.json")).toThrow();
  });

  it("binds Worker DATABASE_URL into postgres-js client", () => {
    const runtime = readRepo("artifacts/api-server/src/lib/cloudflare-runtime.ts");
    const dbIndex = readRepo("lib/db/src/index.ts");
    expect(runtime).toContain("bindWorkerDatabaseUrl");
    expect(dbIndex).toContain("bindWorkerDatabaseUrl");
    expect(dbIndex).toContain("drizzle-orm/postgres-js");
  });

  it("limits event_dispatch_poll cron to subrequest-safe single-event dispatch", () => {
    const wrangler = readRepo("artifacts/api-server/wrangler.toml");
    const dispatcher = readRepo("artifacts/api-server/src/services/EventDispatcher.ts");
    const worker = readRepo("artifacts/api-server/src/workers/EventDispatcherWorker.ts");
    const cronBridge = readRepo("artifacts/api-server/src/schedulers/cloudflare-cron.ts");

    expect(wrangler).toContain('EVENT_DISPATCH_CRON_BATCH_SIZE = "1"');
    expect(wrangler).toContain('EVENT_DISPATCH_CRON_ENABLED = "false"');
    expect(dispatcher).toContain("MAX_EVENTS_PER_CRON = 1");
    expect(dispatcher).toContain("dispatchPendingEventsForCron");
    expect(worker).toContain("dispatchPendingEventsForCron");
    expect(cronBridge).toContain("runEventDispatchPollSafe");
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
