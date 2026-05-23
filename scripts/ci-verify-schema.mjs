#!/usr/bin/env node
/**
 * Fail CI when Postgres is missing tables/columns required for Phase 9 E2E.
 * Run after `pnpm db:ci` (push-force + apply-manual).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!process.env.DATABASE_URL) {
  console.error("[ci-verify-schema] DATABASE_URL or DIRECT_URL is required");
  process.exit(1);
}

const { checkSchemaHealth } = await import(
  "../artifacts/api-server/src/lib/verifySchema.ts"
);
const { pool } = await import("@workspace/db");

try {
  const health = await checkSchemaHealth();
  if (!health.ok) {
    console.error("[ci-verify-schema] Schema not ready for E2E:");
    for (const line of health.missing.slice(0, 50)) {
      console.error(`  ${line}`);
    }
    if (health.missing.length > 50) {
      console.error(`  ... and ${health.missing.length - 50} more`);
    }
    process.exit(1);
  }
  console.log("[ci-verify-schema] OK — runtime + Erector columns present");
} finally {
  await pool.end().catch(() => undefined);
}
