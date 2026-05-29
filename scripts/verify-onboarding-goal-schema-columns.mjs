#!/usr/bin/env node
/**
 * Verify columns required for POST /api/onboarding/goal + validation/run exist.
 * Run after: pnpm db:apply-manual
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const REQUIRED = [
  { table: "validations", column: "contract_id" },
  { table: "validations", column: "validation_kind" },
  { table: "validations", column: "payload_version" },
  { table: "validations", column: "intelligence_payload" },
  { table: "validations", column: "launch_blocked" },
  { table: "validations", column: "readiness" },
  { table: "validations", column: "blueprint_contract" },
  { table: "validations", column: "selected_path_type" },
  { table: "validations", column: "tier" },
  { table: "blueprints", column: "raw_goal_input" },
  { table: "blueprints", column: "raw_purpose_input" },
  { table: "blueprints", column: "raw_goal" },
  { table: "blueprints", column: "goal_final" },
  { table: "blueprints", column: "purpose_final" },
  { table: "blueprints", column: "tier" },
  { table: "blueprints", column: "mode" },
  { table: "blueprints", column: "domain" },
  { table: "blueprints", column: "blueprint_config" },
];

const { pool } = await import("@workspace/db");

try {
  const missing = [];
  for (const { table, column } of REQUIRED) {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    if (r.rowCount === 0) missing.push(`${table}.${column}`);
  }
  if (missing.length > 0) {
    console.error("[verify-onboarding-goal-schema] Missing columns:");
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }
  console.log("[verify-onboarding-goal-schema] OK — required onboarding columns present");
} finally {
  await pool.end().catch(() => undefined);
}
