import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import {
  checkExtendedSchemaHealth,
  runAuthBootPreflight,
  runRuntimeSchemaPreflight,
} from "./verifySchema.js";
import { logger } from "./logger.js";

type JournalEntry = {
  idx: number;
  when: number;
  tag: string;
};

type DrizzleJournal = {
  version?: string;
  dialect?: string;
  entries?: JournalEntry[];
};

type MigrationPreflightResult = {
  ok: boolean;
  migrationsFolder: string | null;
  available: number;
  applied: number;
  pending: string[];
  warnings: string[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveMigrationsFolder(): string | null {
  const configured = process.env.DRIZZLE_MIGRATIONS_FOLDER;
  const candidates = [
    configured ? path.resolve(process.cwd(), configured) : null,
    path.resolve(process.cwd(), "migrations"),
    path.resolve(process.cwd(), "../../migrations"),
    path.resolve(__dirname, "../../../../migrations"),
    path.resolve(__dirname, "../../migrations"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function readJournal(migrationsFolder: string): JournalEntry[] {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!existsSync(journalPath)) {
    throw new Error(`Drizzle migration journal not found at ${journalPath}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as DrizzleJournal;
  return [...(journal.entries ?? [])].sort((a, b) => a.idx - b.idx);
}

async function countAppliedMigrations(): Promise<number> {
  const table = await pool.query<{ exists: string | null }>(
    "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS exists",
  );
  if (!table.rows[0]?.exists) return 0;

  const applied = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations",
  );
  return Number(applied.rows[0]?.count ?? 0);
}

function recordWarning(warnings: string[], message: string, meta?: Record<string, unknown>): void {
  warnings.push(message);
  logger.warn({ ...(meta ?? {}), message }, "[Preflight]");
}

/**
 * Never aborts the HTTP server in production — Worker must keep listening for health/CORS.
 * Set STRICT_STARTUP_PREFLIGHT=true to restore hard-fail behaviour.
 */
export async function runMigrationPreflight(): Promise<MigrationPreflightResult> {
  const warnings: string[] = [];
  const strict = process.env.STRICT_STARTUP_PREFLIGHT === "true";

  logger.info("[Preflight] Checking migration state...");

  const migrationsFolder = resolveMigrationsFolder();
  if (!migrationsFolder) {
    recordWarning(warnings, "Drizzle migrations folder not found");
    if (strict) throw new Error(warnings[warnings.length - 1]!);
    return { ok: false, migrationsFolder: null, available: 0, applied: 0, pending: [], warnings };
  }

  let entries: JournalEntry[] = [];
  try {
    entries = readJournal(migrationsFolder);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordWarning(warnings, message);
    if (strict) throw new Error(message);
    return { ok: false, migrationsFolder, available: 0, applied: 0, pending: [], warnings };
  }

  if (entries.length === 0) {
    recordWarning(warnings, "Drizzle migration journal has no entries");
    if (strict) throw new Error(warnings[warnings.length - 1]!);
    return { ok: false, migrationsFolder, available: 0, applied: 0, pending: [], warnings };
  }

  const applied = await countAppliedMigrations();
  const pending = entries.slice(applied).map((entry) => entry.tag);
  const result: MigrationPreflightResult = {
    ok: pending.length === 0 && applied <= entries.length,
    migrationsFolder,
    available: entries.length,
    applied,
    pending,
    warnings,
  };

  if (applied > entries.length) {
    recordWarning(warnings, "Database has more Drizzle migrations than this codebase knows about", result);
  }

  if (pending.length > 0) {
    recordWarning(
      warnings,
      `Drizzle journal shows unapplied tags: ${pending.join(", ")} (run db:apply-manual on Supabase)`,
      { pending, applied, available: entries.length },
    );
  } else {
    logger.info(result, "[Preflight] All Drizzle migrations applied.");
  }

  const authBoot = await runAuthBootPreflight();
  if (!authBoot.ok) {
    const detail = authBoot.missing.slice(0, 8).join("; ");
    const message = `Auth schema incomplete (${detail}). Run: pnpm db:apply-manual`;
    recordWarning(warnings, message, { missing: authBoot.missing });
    if (strict) throw new Error(message);
  }

  const schema = await runRuntimeSchemaPreflight();
  if (!schema.ok) {
    recordWarning(warnings, "Full runtime schema incomplete — run pnpm db:apply-manual", {
      missing: schema.missing.slice(0, 12),
      count: schema.missing.length,
    });
  }

  const extended = await checkExtendedSchemaHealth();
  if (!extended.ok) {
    logger.warn(
      {
        missing: extended.missing.slice(0, 12),
        count: extended.missing.length,
      },
      "[Preflight] Extended schema incomplete (Erector features degraded)",
    );
  }

  if (warnings.length === 0) {
    logger.info("[Preflight] Database checks passed.");
  }

  return { ...result, ok: warnings.length === 0, warnings };
}
