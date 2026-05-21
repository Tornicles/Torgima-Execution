#!/usr/bin/env node
/**
 * Seed Erector Academy sample courses.
 * Usage: pnpm -F @workspace/api-server exec tsx ../../scripts/seed-erector-academy.mjs
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

  const { ensureAcademyCatalogSeeded } = await import(
    "../artifacts/api-server/src/engines/academy/ErectorAcademyEngine.ts"
  );
  const count = await ensureAcademyCatalogSeeded();
  console.log(`Academy catalog ready: ${count} courses`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
