#!/usr/bin/env node
/**
 * Compare information_schema columns vs verifySchema launch/onboarding requirements.
 * Usage: DIRECT_URL=... node scripts/compare-production-schema.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const REQUIRED = [
  ["validations", "contract_id"],
  ["validations", "validation_kind"],
  ["validations", "intelligence_payload"],
  ["validations", "path_current"],
  ["validations", "is_finalized"],
  ["validations", "handoff_package"],
  ["blueprints", "raw_goal_input"],
  ["blueprints", "tier"],
  ["blueprints", "mode"],
  ["blueprints", "blueprint_tier"],
  ["blueprints", "current_condition"],
  ["plans", "title"],
  ["phases", "title"],
  ["projects", "title"],
  ["actions", "title"],
  ["orders", "condition_at_generation"],
  ["signal_snapshots", "condition"],
];

const { pool } = await import("@workspace/db");

try {
  const missing = [];
  for (const [table, column] of REQUIRED) {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    if (r.rowCount === 0) missing.push(`${table}.${column}`);
  }
  if (missing.length) {
    console.error("[compare-production-schema] Missing:");
    for (const m of missing) console.error(`  ${m}`);
    console.error("Run: pnpm db:apply-manual");
    process.exit(1);
  }
  console.log("[compare-production-schema] OK — required launch/onboarding columns present");
} finally {
  await pool.end().catch(() => undefined);
}
