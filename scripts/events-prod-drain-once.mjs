#!/usr/bin/env node
/**
 * Production bounded event drain — requires CONFIRM_PRODUCTION_EVENT_DRAIN=true.
 * Usage: CONFIRM_PRODUCTION_EVENT_DRAIN=true pnpm events:prod:drain-once
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.CONFIRM_PRODUCTION_EVENT_DRAIN !== "true") {
  console.error(
    "Refusing production drain. Set CONFIRM_PRODUCTION_EVENT_DRAIN=true to proceed.",
  );
  process.exit(1);
}

console.log("Production Event Drain (bounded, single batch)");
try {
  execSync("node scripts/events-drain-once.mjs", { cwd: root, stdio: "inherit", env: process.env });
  console.log("\nevents:prod:drain-once completed");
  process.exit(0);
} catch {
  console.error("\nevents:prod:drain-once FAIL");
  process.exit(1);
}
