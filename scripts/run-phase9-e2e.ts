#!/usr/bin/env node
/**
 * Prompt 9 release gate — runs Phase 9 vitest suite + prints §8 report.
 * Requires: TORGIMA_INTEGRATION=true and DATABASE_URL (dedicated test DB recommended).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

function run(cmd: string, args: string[], env: Record<string, string>): { ok: boolean; output: string } {
  const r = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { ok: r.status === 0, output };
}

const integration = process.env.TORGIMA_INTEGRATION === "true" || process.env.TORGIMA_INTEGRATION === "1";

console.log("═══════════════════════════════════════════");
console.log("TORGIMA PHASE 9 — E2E RELEASE GATE");
console.log("═══════════════════════════════════════════\n");

const typecheck = run("pnpm", ["run", "typecheck"], {});
console.log(typecheck.ok ? "typecheck: PASS" : "typecheck: FAIL");

const unit = run(
  "pnpm",
  ["-F", "@workspace/api-server", "exec", "vitest", "run", "src/tests/unit"],
  {},
);
console.log(unit.ok ? "unit tests: PASS" : "unit tests: FAIL");

const phase9 = run(
  "pnpm",
  ["-F", "@workspace/api-server", "exec", "vitest", "run", "src/tests/e2e/phase9"],
  { TORGIMA_INTEGRATION: integration ? "true" : "false" },
);
console.log(phase9.ok ? "phase9 e2e: PASS" : "phase9 e2e: FAIL");
if (!integration) {
  console.log("  (integration scenarios skipped — set TORGIMA_INTEGRATION=true for full gate)");
}

const playwright = run("pnpm", ["-F", "@workspace/torgima", "exec", "playwright", "test", "tests/e2e"], {});
console.log(playwright.ok ? "playwright: PASS" : "playwright: FAIL (is dev server running?)");

console.log("\nPHASE 1 ACCEPTANCE CRITERIA (requires integration DB for full PASS):");
const criteria = [
  "First activation loop",
  "Normal completion loop (< 5 seconds)",
  "Danger enforcement",
  "False progress detection",
  "Stale dashboard prevention",
  "Event retry + DLQ",
  "Inactivity recovery",
  "PIVOT REQUIRED gate",
  "Guarantee never empty",
];
for (const c of criteria) {
  console.log(`  ${c}: ${phase9.ok && integration ? "PASS" : integration ? "FAIL" : "SKIP"}`);
}

console.log("\nBUILD STATUS:");
console.log(`  typecheck: ${typecheck.ok ? "PASS" : "FAIL"}`);
console.log(`  unit test suite: ${unit.ok ? "PASS" : "FAIL"}`);
console.log(`  E2E test suite: ${phase9.ok ? "PASS" : "FAIL"}`);
console.log(`  browser (playwright): ${playwright.ok ? "PASS" : "FAIL"}`);

const complete = typecheck.ok && unit.ok && phase9.ok;
console.log(`\nPHASE 1 STATUS: ${complete && integration ? "COMPLETE" : "NOT COMPLETE"}`);
console.log(`REMAINING ISSUES: ${complete && integration ? "NONE" : "Run with TORGIMA_INTEGRATION=true on test DB"}`);
console.log("═══════════════════════════════════════════\n");

process.exitCode = complete ? 0 : 1;
