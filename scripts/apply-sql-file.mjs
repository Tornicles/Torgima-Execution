#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-sql-file.mjs <path-to.sql>");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const sql = fs.readFileSync(path.resolve(file), "utf8");
const { pool } = await import("@workspace/db");

const client = await pool.connect();
try {
  await client.query(sql);
  console.log(`[apply-sql] OK: ${file}`);
} finally {
  client.release();
  await pool.end();
}
