import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import { logger } from "./logger.js";
import { verifyOnboardingSchema } from "./verifySchema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveMigrationsDir(): string | null {
  const candidates = [
    path.resolve(__dirname, "../migrations"),
    path.resolve(__dirname, "../../../../scripts/migrations"),
    path.resolve(process.cwd(), "scripts/migrations"),
    path.resolve(process.cwd(), "../scripts/migrations"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

function loadMigrationSqlFiles(): Array<{ name: string; sql: string }> {
  const dir = resolveMigrationsDir();
  if (!dir) {
    logger.warn("[Schema] migrations directory not found — using embedded fallback patches only");
    return [];
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.map((name) => ({
    name,
    sql: readFileSync(path.join(dir, name), "utf8"),
  }));
}

/** Split SQL file into executable statements (respects DO $$ blocks). */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let inDollar = false;

  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) continue;

    if (trimmed.includes("DO $$")) inDollar = true;
    buf += `${line}\n`;
    if (inDollar && trimmed.endsWith("$$;")) {
      statements.push(buf.trim());
      buf = "";
      inDollar = false;
      continue;
    }
    if (!inDollar && trimmed.endsWith(";")) {
      statements.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) statements.push(buf.trim());
  return statements.filter((s) => s.length > 0);
}

const EMBEDDED_FALLBACK: string[] = [
  `DO $$ BEGIN
    ALTER TYPE blueprint_status ADD VALUE IF NOT EXISTS 'validating';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TYPE blueprint_status ADD VALUE IF NOT EXISTS 'awaiting_selection';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TYPE blueprint_status ADD VALUE IF NOT EXISTS 'path_selection';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    CREATE TYPE intelligence_depth AS ENUM ('guided', 'operational', 'strategic');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    CREATE TYPE validation_readiness AS ENUM (
      'not_ready', 'partial', 'ready_proceed', 'ready_with_adjustment', 'blocked_pivot'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS tier user_tier`,
  `ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS mode user_mode DEFAULT 'individual'`,
  `ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS intelligence_depth intelligence_depth`,
  `ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS selection_confirmed_at TIMESTAMPTZ`,
  `ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS blueprint_config JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS tier user_tier`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS intelligence_payload jsonb`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS blueprint_contract jsonb`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS launch_blocked boolean NOT NULL DEFAULT false`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS adjusted_path_confirmed boolean NOT NULL DEFAULT false`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS readiness validation_readiness`,
  `ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS operational_mathematics_json jsonb NOT NULL DEFAULT '{}'::jsonb`,
];

async function runStatement(sql: string, label: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query(sql);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists|duplicate_object|duplicate key/i.test(msg)) {
      return { ok: true };
    }
    logger.warn({ label, err: msg }, "[Schema] Statement skipped");
    return { ok: false, error: msg };
  }
}

export async function ensureSchemaPatches(): Promise<{ applied: number; failed: number; verified: boolean }> {
  let applied = 0;
  let failed = 0;

  const files = loadMigrationSqlFiles();
  for (const file of files) {
    const stmts = splitSqlStatements(file.sql);
    for (const stmt of stmts) {
      const r = await runStatement(stmt, file.name);
      if (r.ok) applied++;
      else failed++;
    }
  }

  for (const stmt of EMBEDDED_FALLBACK) {
    const r = await runStatement(stmt, "embedded-fallback");
    if (r.ok) applied++;
    else failed++;
  }

  const verify = await verifyOnboardingSchema();
  if (verify.ok) {
    logger.info({ applied, failed }, "[Schema] Patches applied — onboarding schema verified");
  } else {
    logger.error(
      {
        applied,
        failed,
        missingColumns: verify.missingColumns,
        missingTables: verify.missingTables,
      },
      "[Schema] Patches incomplete — onboarding will return 503 until fixed",
    );
  }

  return { applied, failed, verified: verify.ok };
}
