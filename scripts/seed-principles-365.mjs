#!/usr/bin/env node
/**
 * Seed 365 execution principles into `principles` table.
 * Usage (from repo root):
 *   pnpm -F @workspace/api-server exec tsx ../../scripts/seed-principles-365.mjs
 * Requires DATABASE_URL or DIRECT_URL in .env.local / .env
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

async function main() {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    console.error("DATABASE_URL or DIRECT_URL required");
    process.exit(1);
  }

  const { ensurePrinciplesSeeded } = await import(
    "../artifacts/api-server/src/engines/principles/Principles365Engine.ts"
  );
  const count = await ensurePrinciplesSeeded();
  console.log(`Principles catalog ready: ${count} rows in principles table`);
  if (count < 365) {
    console.warn("Expected 365 rows — check migration manual-20260521-principles-365-system.sql");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
