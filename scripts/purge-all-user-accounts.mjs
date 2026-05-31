#!/usr/bin/env node
/**
 * Delete every user account and cascaded execution data (blueprints, projects, orders, validations).
 * Requires DATABASE_URL. IRREVERSIBLE.
 *
 * Usage: node scripts/purge-all-user-accounts.mjs
 *        node scripts/purge-all-user-accounts.mjs --confirm
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const confirm = process.argv.includes("--confirm");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(
  join(root, "scripts/migrations/manual-20260527-purge-all-user-accounts.sql"),
  "utf8",
);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if (!confirm) {
  console.error("This permanently deletes ALL user accounts and their projects.");
  console.error("Re-run with: node scripts/purge-all-user-accounts.mjs --confirm");
  process.exit(1);
}

const { pool } = await import("@workspace/db");
try {
  await pool.query(sql);
  const count = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  console.log("Purge complete. Remaining users:", count.rows[0]?.n ?? 0);
} finally {
  await pool.end();
}
