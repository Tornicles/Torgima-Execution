#!/usr/bin/env node
/**
 * Deploy entry for Workers Builds dashboard: `pnpm run deploy`
 * Ensures queues, then deploys using root wrangler.jsonc (Worker name: torgima).
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, cmd, args, opts = {}) {
  console.log(`\n[deploy] ${label}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("Ensuring Cloudflare Queues", "node", ["scripts/ensure-cloudflare-queues.mjs", "--soft"]);
run("Deploying Worker", "pnpm", ["exec", "wrangler", "deploy"]);
