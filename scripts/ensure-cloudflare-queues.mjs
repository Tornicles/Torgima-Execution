#!/usr/bin/env node
/**
 * Ensure Cloudflare Queues referenced in wrangler config exist before deploy.
 * Safe to run repeatedly (Workers Builds, GitHub Actions, local provision).
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const soft = process.argv.includes("--soft") || process.env.QUEUES_SOFT === "1";

/** Primary queue only — DLQ optional; add dead_letter_queue in wrangler.toml after DLQ exists. */
const QUEUES = ["torgima-task-queue"];

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

function queueExists(name) {
  const { status } = runCapture(["exec", "wrangler", "queues", "info", name]);
  return status === 0;
}

function ensureQueue(name) {
  if (queueExists(name)) {
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
  console.warn(
    "[queues] CLOUDFLARE_API_TOKEN not set — attempting wrangler with ambient Workers Builds auth",
  );
}

let ok = true;
for (const name of QUEUES) {
  if (!ensureQueue(name)) ok = false;
}

if (ok) {
  console.log("[queues] Ready");
  process.exit(0);
}

console.warn(
  "[queues] Queue provisioning incomplete — create torgima-task-queue in the Cloudflare dashboard if deploy fails.",
);
process.exit(soft ? 0 : 1);
