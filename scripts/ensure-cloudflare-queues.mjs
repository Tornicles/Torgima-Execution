#!/usr/bin/env node
/**
 * Ensure Cloudflare Queues referenced in wrangler config exist before deploy.
 * Safe to run repeatedly (Workers Builds, GitHub Actions, local provision).
 *
 * Default: non-blocking when Worker queue bindings are commented out (optional).
 * Use --strict to fail deploy if queue provisioning fails AND bindings are active.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const softFlag = process.argv.includes("--soft");
const strictFlag = process.argv.includes("--strict");
const provisionConfig = resolve(root, "scripts/wrangler-provision.toml");
const workerWranglerPaths = [
  resolve(root, "artifacts/api-server/wrangler.toml"),
  resolve(root, "wrangler.jsonc"),
];

/** Primary queue — name is fixed for future producer binding. */
const QUEUE_NAME = "torgima-task-queue";
const QUEUES = [QUEUE_NAME];

function readWorkerWranglerConfigs() {
  return workerWranglerPaths.filter((path) => existsSync(path)).map((path) => readFileSync(path, "utf8"));
}

/**
 * Queue binding is required only when wrangler config has an active producer binding.
 * Commented examples do not count.
 */
export function workerRequiresQueueBinding(configs = readWorkerWranglerConfigs()) {
  for (const text of configs) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
      if (
        /\[\[queues\.producers\]\]/.test(trimmed) ||
        /"queues"\s*:\s*\{/.test(trimmed) ||
        (/binding\s*=\s*"TASK_QUEUE"/.test(trimmed) && !trimmed.startsWith("#"))
      ) {
        return true;
      }
      if (/binding\s*=\s*"TASK_QUEUE"/.test(trimmed)) return true;
      if (/queue\s*=\s*"torgima-task-queue"/.test(trimmed) && /producers/.test(text)) {
        return true;
      }
    }
  }
  return false;
}

function runCapture(args) {
  const result = spawnSync("pnpm", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function wranglerArgs(subcommand) {
  return ["exec", "wrangler", ...subcommand, "--config", provisionConfig];
}

function combinedOutput(result) {
  return `${result.stdout}\n${result.stderr}`.trim();
}

function isAlreadyExistsOutput(output) {
  return /already exists|Queue name is unavailable|duplicate queue|queue already exists/i.test(output);
}

function isInvalidSettingsOutput(output) {
  return /queue settings are invalid|specified queue settings are invalid|invalid queue settings/i.test(
    output,
  );
}

function queueExistsViaWrangler(name) {
  const { status } = runCapture(wranglerArgs(["queues", "info", name]));
  return status === 0;
}

async function listQueuesViaApi() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) return { ok: false, queues: [], reason: "missing Cloudflare credentials" };

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/queues`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) {
    const reason = json.errors?.map((e) => e.message).join("; ") || res.statusText;
    return { ok: false, queues: [], reason };
  }
  return { ok: true, queues: json.result ?? [] };
}

async function queueExistsViaApi(name) {
  const listed = await listQueuesViaApi();
  if (!listed.ok) return { exists: false, reason: listed.reason };
  const found = listed.queues.some((q) => q.queue_name === name || q.queue_id === name);
  return { exists: found };
}

async function createQueueViaApi(name) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) {
    return { ok: false, reason: "missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN" };
  }

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/queues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ queue_name: name }),
  });
  const json = await res.json();
  if (json.success) {
    return { ok: true, method: "api" };
  }

  const reason = json.errors?.map((e) => e.message).join("; ") || res.statusText;
  if (isAlreadyExistsOutput(reason)) {
    return { ok: true, exists: true, method: "api" };
  }
  return { ok: false, reason, method: "api" };
}

function createQueueViaWrangler(name) {
  console.log(`[queues] Creating ${name} via wrangler (default settings)…`);
  const result = runCapture(wranglerArgs(["queues", "create", name]));
  const output = combinedOutput(result);
  if (result.status === 0) {
    return { ok: true, method: "wrangler" };
  }
  if (isAlreadyExistsOutput(output)) {
    return { ok: true, exists: true, method: "wrangler" };
  }
  return { ok: false, reason: output, invalidSettings: isInvalidSettingsOutput(output), method: "wrangler" };
}

async function ensureQueue(name) {
  if (queueExistsViaWrangler(name)) {
    console.log(`[queues] ${name} already exists (wrangler info)`);
    return { ok: true, state: "exists" };
  }

  const apiLookup = await queueExistsViaApi(name);
  if (apiLookup.exists) {
    console.log(`[queues] ${name} already exists (Cloudflare API)`);
    return { ok: true, state: "exists" };
  }

  let wranglerResult = createQueueViaWrangler(name);
  if (wranglerResult.ok) {
    console.log(`[queues] ${name} ready (${wranglerResult.exists ? "already existed" : "created"} via wrangler)`);
    return { ok: true, state: wranglerResult.exists ? "exists" : "created" };
  }

  if (wranglerResult.invalidSettings) {
    console.warn(
      `[queues] Wrangler reported invalid queue settings for ${name}; retrying via Cloudflare API with defaults…`,
    );
  } else {
    console.warn(`[queues] Wrangler create failed for ${name}: ${wranglerResult.reason}`);
  }

  const apiResult = await createQueueViaApi(name);
  if (apiResult.ok) {
    console.log(
      `[queues] ${name} ready (${apiResult.exists ? "already existed" : "created"} via Cloudflare API)`,
    );
    return { ok: true, state: apiResult.exists ? "exists" : "created" };
  }

  console.warn(`[queues] Could not create ${name}: ${apiResult.reason}`);
  return { ok: false, state: "failed", reason: apiResult.reason ?? wranglerResult.reason };
}

async function main() {
  const bindingRequired =
    workerRequiresQueueBinding() || process.env.TORGIMA_REQUIRE_TASK_QUEUE === "true";
  const soft =
    softFlag ||
    process.env.QUEUES_SOFT === "1" ||
    process.env.QUEUES_OPTIONAL === "1" ||
    !bindingRequired;

  if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    console.warn(
      "[queues] CLOUDFLARE_API_TOKEN not set — attempting wrangler with ambient Workers Builds auth",
    );
  }

  if (!bindingRequired) {
    console.log(
      "[queues] TASK_QUEUE binding is not active in wrangler config — queue provisioning is optional",
    );
  }

  const results = [];
  for (const name of QUEUES) {
    results.push(await ensureQueue(name));
  }

  const allOk = results.every((r) => r.ok);
  if (allOk) {
    console.log("[queues] Ready");
    process.exit(0);
  }

  const message =
    "Queue provisioning skipped or already configured. Continuing deploy (TASK_QUEUE binding optional; inline cron/queue handlers active).";
  console.warn(`[queues] ${message}`);

  if (soft && !strictFlag) {
    process.exit(0);
  }

  if (bindingRequired || strictFlag) {
    console.error(
      "[queues] TASK_QUEUE binding is required but queue provisioning failed — aborting deploy.",
    );
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[queues] Unexpected error:", err instanceof Error ? err.message : err);
  const bindingRequired = workerRequiresQueueBinding();
  if (bindingRequired && strictFlag) {
    process.exit(1);
  }
  console.warn("[queues] Queue provisioning skipped or already configured. Continuing deploy.");
  process.exit(0);
});
