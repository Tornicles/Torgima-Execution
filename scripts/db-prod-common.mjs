/**
 * Shared production database verification utilities (Prompt 2).
 * Never logs secrets or full connection strings.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { REQUIRED_PARTIAL_INDEXES } from "./partial-indexes.constants.mjs";

export { REQUIRED_PARTIAL_INDEXES };

export const EXPECTED_PROJECT_REF = "fmynbziciuadnvjlojub";
export const API_DOMAIN = "api.torgima.com";
export const FRONTEND_DOMAINS = ["torgima.com", "www.torgima.com"];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadProductionEnv() {
  dotenv.config({ path: join(root, ".env.production.local") });
  dotenv.config({ path: join(root, ".env.production") });
}

export function resolveProductionDatabaseUrlCandidates() {
  return [
    process.env.TORGIMA_PRODUCTION_DATABASE_URL?.trim(),
    process.env.DATABASE_URL?.trim(),
    process.env.TORGIMA_PRODUCTION_DIRECT_URL?.trim(),
    process.env.DIRECT_URL?.trim(),
  ].filter((url) => url && !isLocalhostUrl(url));
}

export function resolveDirectUrl() {
  const candidates = resolveProductionDatabaseUrlCandidates();
  return candidates[0] ?? null;
}

export async function connectProductionWithFallback() {
  const candidates = resolveProductionDatabaseUrlCandidates();
  if (candidates.length === 0) {
    throw new Error("No production DATABASE_URL or DIRECT_URL configured");
  }
  let lastError;
  for (const url of candidates) {
    try {
      const client = await connectProductionClient(url);
      return { client, url, target: maskDatabaseTarget(url) };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export function requireProductionDirectUrl() {
  loadProductionEnv();
  const candidates = resolveProductionDatabaseUrlCandidates();
  if (candidates.length === 0) {
    console.error(
      "Set DIRECT_URL, TORGIMA_PRODUCTION_DATABASE_URL, or DATABASE_URL to Supabase (not localhost).",
    );
    process.exit(1);
  }
  return candidates[0];
}

export function isLocalhostUrl(url) {
  return !url || /127\.0\.0\.1|localhost/.test(url);
}

export function maskDatabaseTarget(url) {
  if (!url) {
    return {
      configured: false,
      host: null,
      port: null,
      database: null,
      projectRef: null,
      connectionKind: "unset",
      sslEnabled: false,
    };
  }
  try {
    const parsed = new URL(url.replace(/^postgres:/, "postgresql:"));
    const host = parsed.hostname;
    const port = parsed.port || "5432";
    const username = decodeURIComponent(parsed.username || "");
    const dot = username.indexOf(".");
    const projectRef = dot > 0 ? username.slice(dot + 1) : null;
    const maskedRef = projectRef
      ? `${projectRef.slice(0, 4)}…${projectRef.slice(-4)}`
      : null;

    let connectionKind = "direct";
    if (host.includes("pooler.supabase.com")) {
      connectionKind = port === "6543" ? "transaction_pooler" : "session_pooler";
    } else if (host.includes("supabase.co")) {
      connectionKind = "supabase_direct";
    }

    return {
      configured: true,
      host,
      port,
      database: parsed.pathname.replace(/^\//, "") || "postgres",
      projectRef: maskedRef,
      connectionKind,
      sslEnabled:
        url.toLowerCase().includes("sslmode=require") ||
        host.includes("supabase") ||
        host.includes("pooler."),
    };
  } catch {
    return {
      configured: true,
      host: "(parse error)",
      port: null,
      database: null,
      projectRef: null,
      connectionKind: "unknown",
      sslEnabled: false,
    };
  }
}

export function hasVerifyConfirm() {
  return (
    process.env.TORGIMA_PROD_CONFIRM === "1" ||
    process.env.TORGIMA_PROD_CONFIRM === "true" ||
    process.env.CONFIRM_PRODUCTION_SMOKE === "true" ||
    process.env.CONFIRM_PRODUCTION_SMOKE === "1" ||
    process.argv.includes("--confirm")
  );
}

export function hasRepairConfirm() {
  return (
    process.env.CONFIRM_PRODUCTION_REPAIR === "true" ||
    process.env.CONFIRM_PRODUCTION_REPAIR === "1" ||
    process.env.TORGIMA_PROD_CONFIRM === "1" ||
    process.env.TORGIMA_PROD_CONFIRM === "true" ||
    process.argv.includes("--confirm")
  );
}

export function resolvePoolerUrl() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.TORGIMA_PRODUCTION_DATABASE_URL?.trim() ||
    null
  );
}

export async function connectProductionClient(directUrl) {
  const isSupabase = /supabase\.co|pooler\.supabase\.com/i.test(directUrl);
  let connectionString = directUrl;
  if (isSupabase) {
    connectionString = connectionString
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");
  }
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 30_000,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  return client;
}

export function printProductionTargetSummary() {
  loadProductionEnv();
  const direct = maskDatabaseTarget(resolveDirectUrl());
  const pooler = maskDatabaseTarget(resolvePoolerUrl());
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const anon = Boolean(process.env.SUPABASE_ANON_KEY?.trim());
  const service = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  console.log("Production DB Target");
  console.log(`Supabase project ref: ${direct.projectRef ?? pooler.projectRef ?? EXPECTED_PROJECT_REF.slice(0, 4) + "…"}`);
  console.log(`API domain: ${API_DOMAIN}`);
  console.log(`Frontend domain: ${FRONTEND_DOMAINS.join(" / ")}`);
  console.log(
    `Runtime DB connection: ${pooler.configured ? pooler.connectionKind : direct.configured ? direct.connectionKind : "unset"}`,
  );
  console.log(
    `Migration DB connection: ${direct.configured ? direct.connectionKind : "unset"} (${direct.host ?? "n/a"}:${direct.port ?? "n/a"})`,
  );
  console.log(`Service role configured: ${service ? "YES" : "NO"}`);
  console.log(`Anon key configured: ${anon ? "YES" : "NO"}`);
  console.log(`Supabase URL configured: ${supabaseUrl ? "YES" : "NO"}`);
  const verified =
    direct.configured &&
    !isLocalhostUrl(resolveDirectUrl()) &&
    (direct.projectRef?.includes(EXPECTED_PROJECT_REF.slice(0, 4)) ||
      direct.host?.includes("supabase") ||
      pooler.host?.includes("supabase"));
  console.log(`Database target verified: ${verified ? "YES" : "NO"}`);
  console.log("");
  return verified;
}

export const REQUIRED_CORE_TABLES = [
  "users",
  "validations",
  "blueprints",
  "plans",
  "targets",
  "phases",
  "projects",
  "actions",
  "orders",
  "feedback",
  "signal_snapshots",
  "conditions",
  "enforcement_packages",
  "events",
  "dead_letter_events",
  "system_health_logs",
];

export const REQUIRED_ERECTOR_TABLES = [
  "erector_free_validations",
  "erector_paid_validations",
  "erector_validation_runs",
  "erector_threshold_matrix",
  "erector_archetype_rule_packs",
  "erector_verdict_rules",
  "erector_model_versions",
  "erector_false_progress_patterns",
  "erector_capability_graph",
  "erector_framework_veto_rules",
  "erector_archetype_classifications",
  "erector_blueprint_launch_contracts",
  "erector_signals",
];

export const REQUIRED_BHUDHI_TABLES = [
  "bhudhi_logs",
  "bhudhi_memory",
  "bhudhi_usage_budget",
  "bhudhi_engine_registry",
  "bhudhi_context_states",
];

export const REQUIRED_HANDOFF_TABLES = ["handoff_tokens"];

export const REQUIRED_COLUMNS = [
  ["users", "dashboard_mode"],
  ["users", "erector_tier"],
  ["users", "active_blueprint_id"],
  ["users", "onboarding_complete"],
  ["users", "execution_state"],
  ["blueprints", "erector_archetype"],
  ["blueprints", "erector_state"],
  ["blueprints", "validation_id"],
  ["blueprints", "active"],
  ["blueprints", "state_version"],
  ["blueprints", "tier"],
  ["blueprints", "current_condition"],
  ["orders", "erector_archetype"],
  ["orders", "erector_state"],
  ["orders", "condition_at_generation"],
  ["orders", "task_type"],
  ["orders", "difficulty"],
  ["orders", "status"],
  ["orders", "due_date"],
  ["orders", "action_id"],
  ["events", "event_type"],
  ["events", "status"],
  ["events", "retry_count"],
  ["events", "locked_at"],
  ["events", "processed_at"],
  ["events", "payload"],
  ["signal_snapshots", "is_current"],
  ["signal_snapshots", "blueprint_id"],
  ["conditions", "is_current"],
  ["conditions", "blueprint_id"],
  ["conditions", "condition"],
  ["conditions", "weighted_score"],
  ["conditions", "completion_rate"],
  ["conditions", "momentum"],
];

export const MIGRATION_CATEGORIES = [
  { name: "Erector schema", patterns: [/erector-complete/, /erector-validation-system/, /0042/, /0041/] },
  { name: "Erector seed catalog", patterns: [/0043/, /0045/, /0047/, /0048/] },
  { name: "Erector blocked/verdict", patterns: [/erector-blocked-verdict/] },
  { name: "Erector execution bridge", patterns: [/erector-execution-bridge/] },
  { name: "Erector validation upgrade", patterns: [/erector-validation-upgrade/] },
  { name: "Blueprint launch repair", patterns: [/blueprint-launch-repair/] },
  { name: "Validation launch columns", patterns: [/validation-launch-columns/] },
  { name: "Signal system", patterns: [/signal-system/] },
  { name: "Events / FK cascade", patterns: [/events-blueprint-fk/, /events-referencing/] },
  { name: "Bhudhi log repair", patterns: [/bhudhi-log-repair/] },
  { name: "Row-level security", patterns: [/row-level-security/] },
  { name: "Full schema alignment", patterns: [/full-schema-alignment/, /final-complete-alignment/] },
];

export const ERECTOR_SEED_TABLES = [
  { table: "erector_threshold_matrix", minimum: 3, activeOnly: false },
  { table: "erector_archetype_rule_packs", minimum: 10, activeOnly: false },
  { table: "erector_verdict_rules", minimum: 14, activeOnly: true },
  { table: "erector_model_versions", minimum: 10, activeOnly: false },
  { table: "erector_false_progress_patterns", minimum: 10, activeOnly: false },
  { table: "erector_capability_graph", minimum: 20, activeOnly: false },
  { table: "erector_framework_veto_rules", minimum: 1, activeOnly: false },
];

export const FEATURE_FLAG_WATCHLIST = [
  "bhudhi_force_fallbacks",
  "degraded_mode",
  "bhudhi_monthly_cost_cents",
  "ai_enabled",
  "outcome_validation_enabled",
  "compulsion_loop_enabled",
];

export function listManualMigrationFiles() {
  const dir = join(root, "scripts", "migrations");
  return readdirSync(dir)
    .filter((f) => f.startsWith("manual-") && f.endsWith(".sql"))
    .sort();
}

export async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return rows.length > 0;
}

export async function columnExists(client, tableName, columnName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

export async function countTable(client, table, activeOnly = false) {
  if (!(await tableExists(client, table))) return null;
  const sql = activeOnly
    ? `SELECT COUNT(*)::int AS c FROM ${table} WHERE active = true`
    : `SELECT COUNT(*)::int AS c FROM ${table}`;
  const { rows } = await client.query(sql);
  return Number(rows[0]?.c ?? 0);
}

export async function getSeedCounts(client) {
  const results = [];
  for (const spec of ERECTOR_SEED_TABLES) {
    const count = await countTable(client, spec.table, spec.activeOnly);
    results.push({
      table: spec.table,
      count: count ?? 0,
      minimum: spec.minimum,
      missing: count === null || count < spec.minimum,
      exists: count !== null,
    });
  }
  return results;
}

export async function getIndexPresence(client) {
  const { rows } = await client.query(
    `SELECT indexname FROM pg_indexes WHERE indexname = ANY($1::text[])`,
    [REQUIRED_PARTIAL_INDEXES],
  );
  const found = new Set(rows.map((r) => r.indexname));
  return REQUIRED_PARTIAL_INDEXES.map((name) => ({
    name,
    exists: found.has(name),
  }));
}

export async function checkMigrationLedgers(client) {
  const manualFiles = listManualMigrationFiles();
  let manualApplied = [];
  const manualLedgerExists = await tableExists(client, "_manual_migration_ledger");
  if (manualLedgerExists) {
    const { rows } = await client.query("SELECT filename FROM _manual_migration_ledger ORDER BY filename");
    manualApplied = rows.map((r) => r.filename);
  }

  let drizzleCount = 0;
  let drizzleExists = false;
  try {
    const dr = await client.query(
      "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS exists",
    );
    drizzleExists = Boolean(dr.rows[0]?.exists);
    if (drizzleExists) {
      const dc = await client.query("SELECT COUNT(*)::int AS c FROM drizzle.__drizzle_migrations");
      drizzleCount = Number(dc.rows[0]?.c ?? 0);
    }
  } catch {
    drizzleExists = false;
  }

  const journalPath = join(root, "migrations", "meta", "_journal.json");
  let drizzleJournalCount = 0;
  if (existsSync(journalPath)) {
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    drizzleJournalCount = journal.entries?.length ?? 0;
  }

  const erectorRootMigrations = [
    "0041_erector_schema_addendum.sql",
    "0042_erector_schema_1_core_runtime.sql",
    "0043_erector_schema_1_seed_data.sql",
    "0044_erector_schema_2_execution_intelligence.sql",
    "0045_erector_schema_2_seed_data.sql",
    "0046_erector_schema_3_governance_operations.sql",
    "0047_erector_schema_3_seed_data.sql",
    "0048_erector_prompt_1_seed_alignment.sql",
  ];

  const categoryStatus = MIGRATION_CATEGORIES.map((cat) => {
    const manualMatch = manualFiles.filter((f) => cat.patterns.some((p) => p.test(f)));
    const applied = manualMatch.filter((f) => manualApplied.includes(f));
    return {
      category: cat.name,
      manualFiles: manualMatch.length,
      manualApplied: applied.length,
      ok: manualMatch.length === 0 || applied.length > 0,
    };
  });

  return {
    manualFiles: manualFiles.length,
    manualApplied: manualApplied.length,
    manualMissing: manualFiles.filter((f) => !manualApplied.includes(f)),
    drizzleExists,
    drizzleApplied: drizzleCount,
    drizzleJournalCount,
    drizzlePending: Math.max(0, drizzleJournalCount - drizzleCount),
    erectorRootMigrations,
    categoryStatus,
  };
}

export async function queryRuntimeState(client) {
  const safeCount = async (label, sqlText) => {
    try {
      const { rows } = await client.query(sqlText);
      return { label, count: Number(rows[0]?.c ?? 0), error: null };
    } catch (err) {
      return { label, count: null, error: err instanceof Error ? err.message : String(err) };
    }
  };

  return {
    erector: {
      freeValidations: await safeCount("erector_free_validations", "SELECT COUNT(*)::int AS c FROM erector_free_validations"),
      paidValidations: await safeCount("erector_paid_validations", "SELECT COUNT(*)::int AS c FROM erector_paid_validations"),
      validationRuns: await safeCount("erector_validation_runs", "SELECT COUNT(*)::int AS c FROM erector_validation_runs"),
      archetypeClassifications: await safeCount(
        "erector_archetype_classifications",
        "SELECT COUNT(*)::int AS c FROM erector_archetype_classifications",
      ),
      launchContracts: await safeCount(
        "erector_blueprint_launch_contracts",
        "SELECT COUNT(*)::int AS c FROM erector_blueprint_launch_contracts",
      ),
      signals: await safeCount("erector_signals", "SELECT COUNT(*)::int AS c FROM erector_signals"),
    },
    blueprints: {
      total: await safeCount("blueprints", "SELECT COUNT(*)::int AS c FROM blueprints"),
      active: await safeCount("blueprints_active", "SELECT COUNT(*)::int AS c FROM blueprints WHERE active = true"),
      withArchetype: await safeCount(
        "blueprints_erector_archetype",
        "SELECT COUNT(*)::int AS c FROM blueprints WHERE erector_archetype IS NOT NULL",
      ),
      erectorStarted: await safeCount(
        "blueprints_erector_state",
        "SELECT COUNT(*)::int AS c FROM blueprints WHERE erector_state IS NOT NULL AND erector_state != 'not_started'",
      ),
      activeMissingArchetype: await safeCount(
        "active_missing_archetype",
        `SELECT COUNT(*)::int AS c FROM blueprints
         WHERE active = true AND (erector_archetype IS NULL OR erector_archetype = '')`,
      ),
    },
    orders: {
      recent30d: await safeCount(
        "orders_30d",
        "SELECT COUNT(*)::int AS c FROM orders WHERE created_at > NOW() - INTERVAL '30 days'",
      ),
      nullArchetype30d: await safeCount(
        "orders_null_archetype_30d",
        `SELECT COUNT(*)::int AS c FROM orders
         WHERE created_at > NOW() - INTERVAL '30 days'
           AND (erector_archetype IS NULL OR erector_archetype = '')`,
      ),
      notStarted30d: await safeCount(
        "orders_not_started_30d",
        `SELECT COUNT(*)::int AS c FROM orders
         WHERE created_at > NOW() - INTERVAL '30 days'
           AND (erector_state IS NULL OR erector_state = 'not_started')`,
      ),
    },
    events: {
      pending: await safeCount(
        "events_pending",
        "SELECT COUNT(*)::int AS c FROM events WHERE status IN ('pending', 'processing')",
      ),
      retryPending: await safeCount(
        "events_retry",
        "SELECT COUNT(*)::int AS c FROM events WHERE status = 'retry_pending'",
      ),
      deadLetters: await safeCount("dead_letter_events", "SELECT COUNT(*)::int AS c FROM dead_letter_events"),
    },
    signals: {
      currentSnapshots: await safeCount(
        "signal_snapshots_current",
        "SELECT COUNT(*)::int AS c FROM signal_snapshots WHERE is_current = true",
      ),
      currentConditions: await safeCount(
        "conditions_current",
        "SELECT COUNT(*)::int AS c FROM conditions WHERE is_current = true",
      ),
      currentEnforcement: await safeCount(
        "enforcement_current",
        "SELECT COUNT(*)::int AS c FROM enforcement_packages WHERE is_current = true",
      ),
    },
  };
}

export async function getFeatureFlags(client) {
  if (!(await tableExists(client, "feature_flags"))) return [];
  const { rows } = await client.query(
    `SELECT feature_name, enabled, description
     FROM feature_flags
     WHERE feature_name = ANY($1::text[])
     ORDER BY feature_name`,
    [FEATURE_FLAG_WATCHLIST],
  );
  return rows;
}

export async function getTopPendingEvents(client) {
  try {
    const { rows } = await client.query(
      `SELECT event_type, COUNT(*)::int AS c
       FROM events WHERE status IN ('pending', 'processing', 'retry_pending')
       GROUP BY event_type ORDER BY c DESC LIMIT 10`,
    );
    return rows;
  } catch {
    return [];
  }
}

export async function getLatestDeadLetters(client, limit = 5) {
  try {
    const { rows } = await client.query(
      `SELECT event_type, failure_reason, created_at
       FROM dead_letter_events ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      event_type: r.event_type,
      failure_reason: String(r.failure_reason ?? "").slice(0, 120),
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}
