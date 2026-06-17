#!/usr/bin/env node
/**
 * Bounded event drain — one batch only.
 * Usage: pnpm events:drain-once
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

try {
  execSync(
    "pnpm -F @workspace/api-server exec tsx src/scripts/events-cli.ts drain-once",
    { cwd: root, stdio: "inherit", env: process.env },
  );
  process.exit(0);
} catch {
  process.exit(1);
}
