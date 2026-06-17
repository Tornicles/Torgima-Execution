#!/usr/bin/env node
/**
 * Apply authoritative Erector catalog seed data and verify minimum row counts.
 * Exits non-zero if any required catalog table is empty or below minimum.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!process.env.DATABASE_URL) {
  console.error("[apply-erector-seed] DATABASE_URL or DIRECT_URL is required");
  process.exit(1);
}

const { db, pool } = await import("@workspace/db");
const { seedErectorCatalog } = await import("@workspace/db/erector-seed");

try {
  await seedErectorCatalog(db);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[apply-erector-seed] FAIL: ${msg}`);
  process.exit(1);
} finally {
  await pool.end().catch(() => undefined);
}
