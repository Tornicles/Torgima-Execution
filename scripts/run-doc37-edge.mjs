#!/usr/bin/env node
/**
 * DOC 37 §7 — edge case test gate (`pnpm test:edge`).
 *
 * Runs all doc37 api-server suites + structural production-readiness gate.
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

process.stdout.write("DOC 37 — Edge case & error handling tests (test:edge)\n\n");

run("pnpm", [
  "-F",
  "@workspace/api-server",
  "exec",
  "vitest",
  "run",
  "src/tests/e2e/doc37",
]);

process.stdout.write("→ Torgima structural gate (doc37)\n");
run("pnpm", [
  "-F",
  "@workspace/torgima",
  "exec",
  "vitest",
  "run",
  "src/__tests__/unit/doc37-error-handling.test.ts",
]);

process.stdout.write("\nDOC 37 edge tests finished.\n");
