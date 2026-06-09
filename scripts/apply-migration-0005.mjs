#!/usr/bin/env node
/**
 * Apply migration 0005_add_failure_classifications and record in drizzle.__drizzle_migrations.
 * Usage: pnpm -F @workspace/api-server exec tsx ../../scripts/apply-migration-0005.mjs
 * Uses DATABASE_URL or DIRECT_URL from .env.local / .env (Supabase production before run).
 */
import dotenv from "dotenv";
import { readFileSync, createHash } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const MIGRATION_TAG = "0005_add_failure_classifications";
const SQL_PATH = path.join(root, "migrations", `${MIGRATION_TAG}.sql`);

async function main() {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    console.error("DATABASE_URL or DIRECT_URL required");
    process.exit(1);
  }

  const { pool } = await import("@workspace/db");
  const sql = readFileSync(SQL_PATH, "utf8");

  const tableCheck = await pool.query(
    "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS exists",
  );
  if (!tableCheck.rows[0]?.exists) {
    console.error("drizzle.__drizzle_migrations does not exist — run drizzle-kit migrate baseline first");
    process.exit(1);
  }

  const applied = await pool.query(
    "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at",
  );
  console.log("Currently applied migrations:", applied.rowCount);
  for (const row of applied.rows) {
    console.log(" -", row.id, row.created_at);
  }

  const journal = JSON.parse(
    readFileSync(path.join(root, "migrations/meta/_journal.json"), "utf8"),
  );
  const entries = journal.entries ?? [];
  const entry = entries.find((e) => e.tag === MIGRATION_TAG);
  if (!entry) {
    console.error("Journal entry not found for", MIGRATION_TAG);
    process.exit(1);
  }

  const fcExists = await pool.query(
    "SELECT to_regclass('public.failure_classifications')::text AS exists",
  );
  const tableAlready = Boolean(fcExists.rows[0]?.exists);
  console.log("failure_classifications table exists:", tableAlready);

  if (!tableAlready) {
    console.log("Applying SQL from", SQL_PATH);
    await pool.query(sql);
    console.log("SQL applied.");
  } else {
    console.log("Table already exists — skipping SQL (idempotent).");
  }

  const expectedCount = entries.length;
  const currentCount = applied.rowCount ?? 0;

  if (currentCount >= expectedCount) {
    console.log("Migration journal already fully applied (count >= journal entries).");
    await pool.end();
    return;
  }

  if (currentCount !== entry.idx) {
    console.warn(
      `Warning: applied count (${currentCount}) != expected idx (${entry.idx}) for ${MIGRATION_TAG}. Still inserting tracking row.`,
    );
  }

  const hash = createHash("sha256").update(sql).digest("hex");
  const when = entry.when ?? Date.now();

  await pool.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
     VALUES ($1, to_timestamp($2 / 1000.0))
     ON CONFLICT DO NOTHING`,
    [hash, when],
  );

  const after = await pool.query("SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations");
  console.log("Applied migration count after insert:", after.rows[0]?.count);
  console.log("Done:", MIGRATION_TAG);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
