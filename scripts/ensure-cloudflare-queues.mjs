#!/usr/bin/env node
/**
 * Ensure Cloudflare Queues referenced in wrangler config exist before deploy.
 * Safe to run repeatedly (Workers Builds, GitHub Actions, local provision).
 * Never fails the build — warns and continues if provisioning is unavailable.
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const soft = process.argv.includes("--soft") || process.env.QUEUES_SOFT === "1";

/** Primary queue first; DLQ is optional for initial deploy. */
const QUEUES = ["torgima-task-queue", "torgima-task-queue-dlq"];

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

function listQueues() {
  const { status, stdout } = runCapture(["exec", "wrangler", "queues", "list"]);
  if (status !== 0) return new Set();
  return new Set(
    [...stdout.matchAll(/^\s*([a-zA-Z0-9_-]+)\s/mgm)].map((m) => m[1]),
  );
}

function ensureQueue(name, existing) {
  if (existing.has(name)) {
    console.log(`[queues] ${name} already exists`);
    return true;
  }

  console.log(`[queues] Creating ${name}…`);
  const { status, stderr, stdout } = runCapture([
    "exec",
    "wrangler",
    "queues",
    "create",
    name,
  ]);

  if (status === 0) {
    console.log(`[queues] Created ${name}`);
    return true;
  }

  const output = `${stdout}\n${stderr}`;
  if (/already exists|Queue name is unavailable/i.test(output)) {
    console.log(`[queues] ${name} already exists (reported by API)`);
    return true;
  }

  console.warn(`[queues] Could not create ${name}: ${stderr.trim() || stdout.trim()}`);
  return false;
}

if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
  console.warn("[queues] CLOUDFLARE_API_TOKEN not set — skipping queue provisioning");
  process.exit(0);
}

const existing = listQueues();
let ok = true;
for (const name of QUEUES) {
  if (!ensureQueue(name, existing)) ok = false;
}

if (ok) {
  console.log("[queues] Ready");
  process.exit(0);
}

console.warn(
  "[queues] Some queues could not be provisioned — create them in the Cloudflare dashboard or retry deploy.",
);
process.exit(soft ? 0 : 1);
