#!/usr/bin/env node
/**
 * Production event loop verify — read-only, uses DATABASE_URL from env.
 * Usage: pnpm events:prod:verify
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("Production Event Loop Verify (read-only)");
try {
  execSync("node scripts/events-verify.mjs", { cwd: root, stdio: "inherit", env: process.env });
  console.log("\nevents:prod:verify PASS");
  process.exit(0);
} catch {
  console.error("\nevents:prod:verify FAIL");
  process.exit(1);
}
