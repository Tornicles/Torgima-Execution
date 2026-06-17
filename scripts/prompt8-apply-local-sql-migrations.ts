#!/usr/bin/env node
/**
 * Prompt 8 helper — apply local `lib/db/migrations/*.sql` files against the current DATABASE_URL.
 * These are additive migrations used by the app runtime but not part of drizzle-kit root migrations.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "lib", "db", "migrations");

const files = [
  "20260617023300_blueprint_erector_baseline_execution_lock.sql",
  "20260617024400_paid_intake_session_state.sql",
];

async function main() {
  for (const f of files) {
    const full = path.join(migrationsDir, f);
    const sql = readFileSync(full, "utf8");
    await pool.query(sql);
    console.log(`[prompt8] applied ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

