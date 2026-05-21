#!/usr/bin/env node
/**
 * Applies ordered manual SQL migrations from scripts/migrations/ when live DB lags Drizzle schema.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);
const root = path.resolve(migrationsDir, "..");
for (const name of [".env.local", ".env"]) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) {
    const dotenv = await import("dotenv");
    dotenv.config({ path: p });
  }
}
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!process.env.DATABASE_URL) {
  console.error("[migrations] DATABASE_URL not set");
  process.exit(1);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.startsWith("manual-") && f.endsWith(".sql"))
  .sort();

const { pool } = await import("@workspace/db");
const client = await pool.connect();

try {
  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const sql = fs.readFileSync(full, "utf8");
    try {
      await client.query(sql);
      console.log(`[migrations] OK ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[migrations] WARN ${file}: ${msg}`);
    }
  }
} finally {
  client.release();
  await pool.end();
}
