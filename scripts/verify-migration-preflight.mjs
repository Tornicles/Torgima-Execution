#!/usr/bin/env node
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const { runMigrationPreflight } = await import(
  "../artifacts/api-server/src/lib/migrationPreflight.ts"
);

try {
  const result = await runMigrationPreflight();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
} catch (err) {
  console.error("PREFLIGHT FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
}
