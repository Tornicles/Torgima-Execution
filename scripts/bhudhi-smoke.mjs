#!/usr/bin/env node
/**
 * Local Bhudhi intelligence smoke — registry, policy, fallback logging.
 * Usage: pnpm bhudhi:smoke
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("Bhudhi Smoke Tests");
console.log("");

try {
  execSync(
    "pnpm -F @workspace/api-server exec vitest run src/tests/unit/bhudhi/bhudhi-smoke.test.ts --reporter=verbose",
    { cwd: root, stdio: "inherit" },
  );
  console.log("\nBhudhi smoke: PASS");
  process.exit(0);
} catch {
  console.error("\nBhudhi smoke: FAIL");
  process.exit(1);
}
