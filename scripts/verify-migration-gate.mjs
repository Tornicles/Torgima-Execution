#!/usr/bin/env node
import dotenv from "dotenv";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
await client.connect();

const checks = [
  {
    name: "structured feedback columns",
    sql: `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'feedback' AND column_name IN ('confidence_weight', 'had_blocker')
      ORDER BY column_name`,
    expect: 2,
  },
  {
    name: "bhudhi_signals + dead_letter_events",
    sql: `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('bhudhi_signals', 'dead_letter_events')
      ORDER BY table_name`,
    expect: 2,
  },
  {
    name: "bhudhi_logs table",
    sql: `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'bhudhi_logs'`,
    expect: 1,
  },
  {
    name: "partial indexes",
    sql: `SELECT indexname FROM pg_indexes WHERE indexname IN (
      'one_active_blueprint_per_user',
      'one_current_signal_per_blueprint',
      'one_current_condition_per_blueprint',
      'one_current_enforcement_per_blueprint',
      'one_current_state_memory_per_blueprint',
      'one_current_domain_per_blueprint'
    ) ORDER BY indexname`,
    expect: 6,
  },
  {
    name: "task_generation_log.idempotency_key",
    sql: `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'task_generation_log' AND column_name = 'idempotency_key'`,
    expect: 1,
  },
];

let ok = true;
for (const c of checks) {
  const { rows } = await client.query(c.sql);
  const pass = rows.length === c.expect;
  console.log(pass ? "PASS" : "FAIL", c.name, `(${rows.length}/${c.expect})`);
  if (!pass) ok = false;
}
await client.end();
process.exit(ok ? 0 : 1);
