#!/usr/bin/env node
/**
 * Apply all scripts/migrations/manual-*.sql in sorted order.
 * Run from repo root: pnpm db:apply-manual
 * Or: cd lib/db && pnpm exec tsx ../../scripts/apply-all-manual-migrations.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const dir = path.join(root, "scripts", "migrations");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("manual-") && f.endsWith(".sql"))
  .sort();

const { pool } = await import("@workspace/db");
const client = await pool.connect();
let failed = 0;

try {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    try {
      await client.query(sql);
      console.log(`[apply-all] OK ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[apply-all] WARN ${file}: ${msg.slice(0, 120)}`);
      failed++;
    }
  }
} finally {
  client.release();
  await pool.end();
}

console.log(`[apply-all] Done. ${files.length} files, ${failed} warnings.`);
process.exit(0);
