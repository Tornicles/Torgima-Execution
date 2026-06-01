#!/usr/bin/env node
/**
 * Apply the 5 production-gate SQL migrations (DIRECT_URL) and run verification queries.
 * Usage (PowerShell):
 *   $env:DIRECT_URL="postgresql://postgres:...@db....supabase.co:5432/postgres"
 *   $env:DATABASE_URL="postgresql://postgres....pooler.supabase.com:6543/postgres"
 *   node scripts/apply-production-gate.mjs
 *   node scripts/verify-migration-gate.mjs
 *   pnpm verify:lifecycle
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!directUrl || /127\.0\.0\.1|localhost/.test(directUrl)) {
  console.error(
    "Set DIRECT_URL to your Supabase direct connection (not localhost).",
  );
  process.exit(1);
}

const migrations = [
  "scripts/migrations/manual-20260528-structured-feedback.sql",
  "scripts/migrations/manual-20260601-missing-tables-repair.sql",
  "scripts/migrations/manual-20260601-bhudhi-log-repair.sql",
  "scripts/apply-partial-indexes.sql",
  "lib/db/migrations/20260527120000_add_task_generation_log_idempotency_key.sql",
];

const client = new pg.Client({ connectionString: directUrl });
await client.connect();

for (const rel of migrations) {
  const path = join(root, rel);
  const sql = readFileSync(path, "utf8");
  console.log(`Applying ${rel}...`);
  try {
    await client.query(sql);
    console.log(`  OK`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists/i.test(msg)) {
      console.log(`  SKIP (already exists): ${msg.slice(0, 120)}`);
    } else {
      console.error(`  FAIL: ${msg}`);
      await client.end();
      process.exit(1);
    }
  }
}

console.log("\nVerification queries:");
const verifications = [
  {
    label: "feedback columns",
    sql: `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'feedback'
      AND column_name IN ('confidence_weight', 'had_blocker', 'blocker_type')
      ORDER BY column_name`,
    min: 2,
  },
  {
    label: "repair tables",
    sql: `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('bhudhi_logs', 'bhudhi_signals', 'dead_letter_events')
      ORDER BY table_name`,
    min: 3,
  },
  {
    label: "partial indexes",
    sql: `SELECT indexname FROM pg_indexes WHERE indexname IN (
      'one_active_blueprint_per_user',
      'one_current_signal_per_blueprint',
      'one_current_condition_per_blueprint',
      'one_current_enforcement_per_blueprint',
      'one_current_state_memory_per_blueprint',
      'one_current_domain_per_blueprint'
    ) ORDER BY indexname`,
    min: 6,
  },
  {
    label: "idempotency column",
    sql: `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'task_generation_log' AND column_name = 'idempotency_key'`,
    min: 1,
  },
  {
    label: "idempotency index",
    sql: `SELECT indexname FROM pg_indexes
      WHERE indexname = 'idx_task_generation_log_idempotency_key'`,
    min: 1,
  },
];

let ok = true;
for (const v of verifications) {
  const { rows } = await client.query(v.sql);
  const pass = rows.length >= v.min;
  console.log(pass ? "PASS" : "FAIL", v.label, `(${rows.length} rows, need >=${v.min})`);
  if (!pass) ok = false;
}

await client.end();
process.exit(ok ? 0 : 1);
