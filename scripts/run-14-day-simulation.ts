#!/usr/bin/env node
/**
 * TORGIMA 14-day autonomous execution simulation (real Postgres).
 * Run: pnpm -F @workspace/scripts sim:14day
 * Requires DATABASE_URL in .env.local or .env
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(repoRoot, ".env.local") });
dotenv.config({ path: join(repoRoot, ".env") });
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
process.env.TORGIMA_INTEGRATION = "true";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required to run the 14-day simulation.");
  process.exit(1);
}

if (/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)) {
  console.warn(
    "[14-Day Sim] DATABASE_URL targets localhost. Start Postgres locally or point .env.local at Supabase/Railway.",
  );
}

const apiBase = join(repoRoot, "artifacts/api-server/src");
const { pathToFileURL } = await import("node:url");

const mod = await import(
  pathToFileURL(join(apiBase, "simulation/fourteenDaySimulation.js")).href
);

console.log("[14-Day Sim] Bootstrapping SaaS creator subject…");
const report = await mod.run14DaySimulation();
console.log(mod.formatSimulationReport(report));
process.exit(report.ok ? 0 : 1);
