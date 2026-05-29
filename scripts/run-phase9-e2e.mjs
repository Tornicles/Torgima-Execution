#!/usr/bin/env node
/**
 * Full local Phase 9 E2E: start Postgres → db:ci → scenarios.test.ts
 */
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function loadEnv() {
  dotenv.config({ path: join(root, ".env.local") });
  dotenv.config({ path: join(root, ".env") });
  try {
    const pgEnv = await readFile(join(root, ".local", "postgres.env"), "utf8");
    for (const line of pgEnv.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}

async function main() {
  console.log("=== Phase 9 local E2E ===\n");

  run("node", ["scripts/start-local-postgres.mjs"]);
  await loadEnv();

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/torgima_test";
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }

  process.env.TORGIMA_INTEGRATION = "true";

  console.log("\n=== Applying schema (pnpm db:ci) ===\n");
  run("pnpm", ["db:ci"]);

  console.log("\n=== Phase 9 scenarios ===\n");
  run("pnpm", [
    "-F",
    "@workspace/api-server",
    "exec",
    "vitest",
    "run",
    "src/tests/e2e/phase9/scenarios.test.ts",
    "--testTimeout=120000",
    "--hookTimeout=120000",
  ]);

  console.log("\n=== Phase 9 E2E passed ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
