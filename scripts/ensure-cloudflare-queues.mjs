#!/usr/bin/env node
/**
 * Ensure Cloudflare Queues referenced in wrangler.jsonc exist before deploy.
 * Safe to run repeatedly (Workers Builds, GitHub Actions, local provision).
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** DLQ first — consumer config references it on the primary queue. */
const QUEUES = ["torgima-task-queue-dlq", "torgima-task-queue"];

if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
  console.warn("[queues] CLOUDFLARE_API_TOKEN not set — skipping queue provisioning");
  process.exit(0);
}

function runCapture(args) {
  const result = spawnSync("pnpm", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function run(args) {
  const result = spawnSync("pnpm", args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: pnpm ${args.join(" ")}`);
  }
}

function queueExists(name) {
  const { status } = runCapture(["exec", "wrangler", "queues", "info", name]);
  return status === 0;
}

function ensureQueue(name) {
  if (queueExists(name)) {
    console.log(`[queues] ${name} already exists`);
    return;
  }
  console.log(`[queues] Creating ${name}…`);
  run(["exec", "wrangler", "queues", "create", name]);
}

for (const name of QUEUES) {
  ensureQueue(name);
}

console.log("[queues] Ready");
