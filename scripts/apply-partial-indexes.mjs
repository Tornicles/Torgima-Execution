#!/usr/bin/env node
/**
 * Apply partial unique indexes (single-row is_current/active invariants).
 * Idempotent — safe for CI, local, and production repair.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { REQUIRED_PARTIAL_INDEXES } from "./partial-indexes.constants.mjs";

export { REQUIRED_PARTIAL_INDEXES };

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[apply-partial-indexes] DATABASE_URL or DIRECT_URL is required");
  process.exit(1);
}

const sqlPath = join(root, "scripts/apply-partial-indexes.sql");
const sqlText = readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  console.log("[apply-partial-indexes] Applying scripts/apply-partial-indexes.sql ...");
  await client.query(sqlText);

  const { rows } = await client.query(
    `SELECT indexname FROM pg_indexes
     WHERE indexname = ANY($1::text[])
     ORDER BY indexname`,
    [REQUIRED_PARTIAL_INDEXES],
  );
  const found = new Set(rows.map((r) => r.indexname));
  const missing = REQUIRED_PARTIAL_INDEXES.filter((name) => !found.has(name));

  console.log("Partial index verification");
  for (const name of REQUIRED_PARTIAL_INDEXES) {
    const status = found.has(name) ? "PASS" : "FAIL";
    console.log(`${name.padEnd(42)} ${status}`);
  }
  console.log("");
  if (missing.length > 0) {
    console.error(`Result: FAIL — missing indexes: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("Result: PASS");
} finally {
  await client.end();
}
