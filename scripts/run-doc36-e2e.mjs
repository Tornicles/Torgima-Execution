#!/usr/bin/env node
/**
 * DOC 36 — run integration + Playwright loop gate tests.
 *
 * Local integration (Postgres):
 *   TORGIMA_INTEGRATION=true DATABASE_URL=... node scripts/run-doc36-e2e.mjs
 *
 * Optional production API checks:
 *   DOC36_API_BASE=https://... INTERNAL_AUTH_SECRET=... node scripts/run-doc36-e2e.mjs
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const integrationOn =
  ["1", "true", "yes"].includes(String(process.env.TORGIMA_INTEGRATION ?? "").toLowerCase()) &&
  Boolean(process.env.DATABASE_URL);

process.stdout.write("DOC 36 — End-to-end loop testing\n\n");

if (integrationOn) {
  process.stdout.write("→ Reset test user\n");
  run("pnpm", ["-F", "@workspace/scripts", "exec", "tsx", "./doc36-reset-test-user.ts"]);

  process.stdout.write("→ API server vitest (doc36)\n");
  run(
    "pnpm",
    ["-F", "@workspace/api-server", "exec", "vitest", "run", "src/tests/e2e/doc36"],
    { TORGIMA_INTEGRATION: "true" },
  );
} else {
  process.stdout.write(
    "⊘ Skipping integration (set TORGIMA_INTEGRATION=true and DATABASE_URL)\n",
  );
}

process.stdout.write("→ Torgima unit gate (doc36 structure)\n");
run("pnpm", [
  "-F",
  "@workspace/torgima",
  "exec",
  "vitest",
  "run",
  "src/__tests__/unit/doc36-e2e-loop.test.ts",
]);

process.stdout.write("→ Playwright doc36\n");
run("pnpm", ["-F", "@workspace/torgima", "exec", "playwright", "test", "tests/e2e/doc36"]);

process.stdout.write("\nDOC 36 runner finished.\n");
