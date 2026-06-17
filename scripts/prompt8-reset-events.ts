#!/usr/bin/env node
/**
 * Prompt 8 helper — reset event queue tables in test DB only.
 * This is test harness setup; do not run against production.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pool } from "@workspace/db";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  await pool.query("DELETE FROM dead_letter_events");
  await pool.query("DELETE FROM events");
  console.log("Event tables cleared.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

