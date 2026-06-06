#!/usr/bin/env node
/**
 * Safe Worker deploy: auth → queues → build → dry-run verify → deploy.
 * Uses CLOUDFLARE_API_TOKEN from the environment (never committed).
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, cmd, args) {
  console.log(`\n[cf:deploy] ${label}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("Checking API token…", "node", ["scripts/verify-cloudflare-auth.mjs"]);
run("Ensuring Queues…", "node", ["scripts/ensure-cloudflare-queues.mjs"]);
run("Building API Worker bundle…", "pnpm", ["--filter", "@workspace/api-server", "build"]);
run("Dry-run deploy (local verification)…", "pnpm", [
  "exec",
  "wrangler",
  "deploy",
  "--dry-run",
  "--config",
  "artifacts/api-server/wrangler.toml",
]);
run("Deploying Worker…", "pnpm", ["run", "deploy:cloudflare:api"]);

console.log("\n[cf:deploy] Done.");
