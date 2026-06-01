#!/usr/bin/env node
/**
 * Apply scripts/migrations/manual-*.sql in sorted order with ledger tracking.
 * Run from repo root: pnpm db:apply-manual
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const LEDGER_DDL = `
CREATE TABLE IF NOT EXISTS _manual_migration_ledger (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const dryRun = process.argv.includes("--dry-run");

const dir = path.join(root, "scripts", "migrations");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("manual-") && f.endsWith(".sql"))
  .sort();

if (dryRun) {
  console.log(`[apply-all] DRY RUN — ${files.length} manual migration file(s):`);
  for (const file of files) {
    console.log(`  ${file}`);
  }
  process.exit(0);
}

const { pool } = await import("@workspace/db");
const client = await pool.connect();
let applied = 0;
let skipped = 0;
let failed = 0;

try {
  await client.query(LEDGER_DDL);

  const { rows: ledgerRows } = await client.query(
    "SELECT filename FROM _manual_migration_ledger",
  );
  const appliedSet = new Set(ledgerRows.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`[apply-all] SKIP ${file} (already in ledger)`);
      skipped++;
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO _manual_migration_ledger (filename) VALUES ($1) ON CONFLICT DO NOTHING",
        [file],
      );
      await client.query("COMMIT");
      console.log(`[apply-all] OK ${file}`);
      applied++;
    } catch (err) {
      await client.query("ROLLBACK");
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[apply-all] FAIL ${file}: ${msg.slice(0, 200)}`);
      failed++;
      if (process.env.STRICT_MANUAL_MIGRATIONS === "true") {
        throw err;
      }
    }
  }
} finally {
  client.release();
  await pool.end();
}

console.log(
  `[apply-all] Done. ${files.length} files total — applied: ${applied}, skipped: ${skipped}, failed: ${failed}.`,
);

if (failed > 0 && process.env.STRICT_MANUAL_MIGRATIONS === "true") {
  process.exit(1);
}
process.exit(0);
