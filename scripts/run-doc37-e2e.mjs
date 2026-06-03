#!/usr/bin/env node
/**
 * DOC 37 — error handling & edge case test gate.
 *
 * Integration (Postgres):
 *   TORGIMA_INTEGRATION=true DATABASE_URL=... node scripts/run-doc37-e2e.mjs
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

process.stdout.write("DOC 37 — Error handling & edge case testing\n\n");

process.stdout.write("→ API server vitest (doc37 unit/e2e)\n");
run("pnpm", [
  "-F",
  "@workspace/api-server",
  "exec",
  "vitest",
  "run",
  "src/tests/e2e/doc37",
]);

if (integrationOn) {
  process.stdout.write("→ Integration-enabled doc37 suites (same run, DB-backed cases)\n");
} else {
  process.stdout.write(
    "⊘ Set TORGIMA_INTEGRATION=true and DATABASE_URL for DB-backed doc37 integration cases\n",
  );
}

process.stdout.write("→ Torgima unit gate (doc37 structure)\n");
run("pnpm", [
  "-F",
  "@workspace/torgima",
  "exec",
  "vitest",
  "run",
  "src/__tests__/unit/doc37-error-handling.test.ts",
]);

const playwrightBase =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";

async function urlReady(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

if (process.env.DOC37_SKIP_PLAYWRIGHT === "true") {
  process.stdout.write("⊘ Playwright skipped (DOC37_SKIP_PLAYWRIGHT=true)\n");
} else if (await urlReady(playwrightBase)) {
  process.stdout.write("→ Playwright doc37 frontend-resilience\n");
  run("pnpm", [
    "-F",
    "@workspace/torgima",
    "exec",
    "playwright",
    "test",
    "tests/e2e/doc37",
  ]);
} else {
  process.stdout.write(
    `⊘ Playwright skipped — start Torgima dev server at ${playwrightBase} or set PLAYWRIGHT_BASE_URL\n`,
  );
}

process.stdout.write("\nDOC 37 runner finished.\n");
