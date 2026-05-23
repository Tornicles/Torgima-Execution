import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import { checkExtendedSchemaHealth, runRuntimeSchemaPreflight } from "./verifySchema.js";
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

function failOrWarn(message: string, result: MigrationPreflightResult): MigrationPreflightResult {
  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }

  logger.warn({ ...result, message }, "[Preflight] Migration state not authoritative");
  return result;
}

export async function runMigrationPreflight(): Promise<MigrationPreflightResult> {
  logger.info("[Preflight] Checking migration state...");

  const migrationsFolder = resolveMigrationsFolder();
  if (!migrationsFolder) {
    return failOrWarn("Drizzle migrations folder not found", {
      ok: false,
      migrationsFolder: null,
      available: 0,
      applied: 0,
      pending: [],
    });
  }

  const entries = readJournal(migrationsFolder);
  if (entries.length === 0) {
    return failOrWarn("Drizzle migration journal has no entries; generate and apply a baseline/catch-up migration", {
      ok: false,
      migrationsFolder,
      available: 0,
      applied: 0,
      pending: [],
    });
  }

  const applied = await countAppliedMigrations();
  const pending = entries.slice(applied).map((entry) => entry.tag);
  const result = {
    ok: pending.length === 0 && applied <= entries.length,
    migrationsFolder,
    available: entries.length,
    applied,
    pending,
  };

  if (applied > entries.length) {
    return failOrWarn("Database has more Drizzle migrations than this codebase knows about", result);
  }

  if (pending.length > 0) {
    logger.warn(
      { pending, applied, available: entries.length },
      "[Preflight] Drizzle journal shows unapplied tags (common after manual SQL / push); verifying runtime schema",
    );
  } else {
    logger.info(result, "[Preflight] All Drizzle migrations applied.");
  }

  const schema = await runRuntimeSchemaPreflight();
  if (!schema.ok) {
    const detail = schema.missing.slice(0, 8).join("; ");
    const suffix =
      schema.missing.length > 8 ? ` (+${schema.missing.length - 8} more)` : "";
    const message =
      `Database schema is incomplete (${detail}${suffix}). ` +
      "On Railway run: pnpm -F @workspace/db migrate && pnpm db:apply-manual (use DIRECT_URL for DDL), then redeploy.";
    return failOrWarn(message, {
      ok: false,
      migrationsFolder,
      available: entries.length,
      applied,
      pending: [...pending, ...schema.missing],
    });
  }

  const extended = await checkExtendedSchemaHealth();
  if (!extended.ok) {
    logger.warn(
      {
        missing: extended.missing.slice(0, 12),
        count: extended.missing.length,
      },
      "[Preflight] Extended schema incomplete (Erector/blueprint features degraded; auth still available)",
    );
  }

  logger.info("[Preflight] Runtime schema tables present. Database in sync.");
  return { ...result, ok: true };
}
