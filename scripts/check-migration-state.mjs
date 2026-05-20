#!/usr/bin/env node
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const { pool } = await import("@workspace/db");
const rows = await pool.query(
  "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id",
);
console.log("drizzle.__drizzle_migrations count:", rows.rowCount);
for (const r of rows.rows) {
  console.log(`  ${r.id} @ ${r.created_at}`);
}
const fc = await pool.query(
  "SELECT to_regclass('public.failure_classifications')::text AS exists",
);
console.log("failure_classifications:", fc.rows[0]?.exists ? "EXISTS" : "MISSING");
await pool.end();
