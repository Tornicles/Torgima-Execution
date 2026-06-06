#!/usr/bin/env node
/**
 * Drop-in wrangler bin replacement for monorepo root.
 * Workers Builds runs `npx wrangler deploy`; this shim provisions queues first.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

function findRepoRoot() {
  const markers = ["wrangler.jsonc", "scripts/ensure-cloudflare-queues.mjs"];
  for (const start of [process.cwd(), here]) {
    let dir = start;
    while (dir !== dirname(dir)) {
      if (markers.every((m) => existsSync(resolve(dir, m)))) {
        return dir;
      }
      dir = dirname(dir);
    }
  }
  return resolve(here, "../../..");
}

const repoRoot = findRepoRoot();
const args = process.argv.slice(2);
const isDeploy =
  args[0] === "deploy" ||
  (args[0] === "versions" && args[1] === "upload");

if (isDeploy) {
  console.log("[wrangler-shim] Ensuring Cloudflare Queues before deploy (soft)…");
  const ensureScript = resolve(repoRoot, "scripts/ensure-cloudflare-queues.mjs");
  spawnSync(process.execPath, [ensureScript, "--soft"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
}

const upstreamEntry = require.resolve("wrangler-upstream/bin/wrangler.js");
const result = spawnSync(process.execPath, [upstreamEntry, ...args], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
