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

  it("CI deploy health gate handles Cloudflare WAF challenge with API fallback", () => {
    const workflow = readRepo(".github/workflows/deploy-cloudflare.yml");
    expect(workflow).toContain("https://api.torgima.com/health");
    expect(workflow).toContain("User-Agent: GitHubActions-CI");
    expect(workflow).toContain("cf-mitigated");
    expect(workflow).toContain("Cloudflare WAF managed challenge");
    expect(workflow).toContain("workers/scripts/torgima");
    expect(workflow).toContain("api/debug/cloudflare-env");
    expect(workflow).toContain("|| true");
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

  it("registers cron workers in the queue consumer", () => {
    const handler = readRepo("artifacts/api-server/src/queues/handler.ts");
    expect(handler).toContain("SessionCleanupWorker");
    expect(handler).toContain("InactivityWorker");
    expect(handler).toContain("PatternScanWorker");
    expect(handler).toContain("StateIntegrityWorker");
    expect(handler).toContain("EventDispatcherWorker");
  });
});
