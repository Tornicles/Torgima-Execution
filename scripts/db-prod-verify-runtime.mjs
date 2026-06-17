#!/usr/bin/env node
/**
 * Production-safe runtime verification (read-only). Requires explicit confirmation.
 * Usage:
 *   TORGIMA_PROD_CONFIRM=1 pnpm db:prod:verify-runtime
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasVerifyConfirm,
  loadProductionEnv,
  connectProductionWithFallback,
  printProductionTargetSummary,
} from "./db-prod-common.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadProductionEnv();

if (!hasVerifyConfirm()) {
  console.error(
    "Production verify requires TORGIMA_PROD_CONFIRM=1 or --confirm (read-only; no data changes).",
  );
  process.exit(1);
}

printProductionTargetSummary();

const { url, target } = await connectProductionWithFallback();
console.log(`[db-prod-verify-runtime] Connected: ${target.host}:${target.port} (${target.connectionKind})`);

const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };

const result = spawnSync(process.execPath, [join(root, "scripts/db-prod-verify-full.mjs")], {
  cwd: root,
  stdio: "inherit",
  env,
});
process.exit(result.status ?? 1);
