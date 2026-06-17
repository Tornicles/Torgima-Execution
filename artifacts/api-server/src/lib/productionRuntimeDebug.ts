/**
 * Read-only production runtime diagnostics for /api/debug/* endpoints.
 * Never returns secrets, credentials, or PII.
 */
import { pool } from "@workspace/db";
import {
  buildSafeDatabaseTargetSnapshot,
  resolveDatabaseUrlBindingSource,
} from "./databaseTargetDebug.js";

const REQUIRED_PARTIAL_INDEXES = [
  "one_active_blueprint_per_user",
  "one_current_signal_per_blueprint",
  "one_current_condition_per_blueprint",
  "one_current_enforcement_per_blueprint",
  "one_current_state_memory_per_blueprint",
  "one_current_domain_per_blueprint",
];

const SEED_TABLES: Array<{ table: string; minimum: number; activeOnly?: boolean }> = [
  { table: "erector_threshold_matrix", minimum: 3 },
  { table: "erector_archetype_rule_packs", minimum: 10 },
  { table: "erector_verdict_rules", minimum: 14, activeOnly: true },
  { table: "erector_model_versions", minimum: 10 },
  { table: "erector_false_progress_patterns", minimum: 10 },
  { table: "erector_capability_graph", minimum: 20 },
  { table: "erector_framework_veto_rules", minimum: 1 },
];

const WATCH_FLAGS = [
  "bhudhi_force_fallbacks",
  "degraded_mode",
  "bhudhi_monthly_cost_cents",
  "ai_enabled",
  "outcome_validation_enabled",
];

async function countTable(table: string, activeOnly = false): Promise<number | null> {
  try {
    const clause = activeOnly ? " WHERE active = true" : "";
    const result = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM ${table}${clause}`,
    );
    return Number(result.rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

export async function getPartialIndexStatus(): Promise<{
  ok: boolean;
  indexes: Array<{ name: string; exists: boolean }>;
}> {
  const result = await pool.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE indexname = ANY($1::text[])`,
    [REQUIRED_PARTIAL_INDEXES],
  );
  const found = new Set(result.rows.map((r) => r.indexname));
  const indexes = REQUIRED_PARTIAL_INDEXES.map((name) => ({
    name,
    exists: found.has(name),
  }));
  return { ok: indexes.every((i) => i.exists), indexes };
}

export async function getErectorSeedStatus(): Promise<{
  ok: boolean;
  tables: Array<{ table: string; count: number; minimum: number; ok: boolean }>;
}> {
  const tables = [];
  for (const spec of SEED_TABLES) {
    const count = await countTable(spec.table, spec.activeOnly);
    tables.push({
      table: spec.table,
      count: count ?? 0,
      minimum: spec.minimum,
      ok: count !== null && count >= spec.minimum,
    });
  }
  return { ok: tables.every((t) => t.ok), tables };
}

export async function getFeatureFlagSnapshot(): Promise<
  Array<{ feature_name: string; enabled: boolean }>
> {
  try {
    const result = await pool.query<{ feature_name: string; enabled: boolean }>(
      `SELECT feature_name, enabled FROM feature_flags
       WHERE feature_name = ANY($1::text[]) ORDER BY feature_name`,
      [WATCH_FLAGS],
    );
    return result.rows;
  } catch {
    return [];
  }
}

export async function getEventQueueSummary(): Promise<{
  pending: number;
  retryPending: number;
  deadLetters: number;
}> {
  const pending = await countTable("events").catch(() => 0);
  let pendingCount = 0;
  let retryPending = 0;
  let deadLetters = 0;
  try {
    const p = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM events WHERE status IN ('pending', 'processing')`,
    );
    pendingCount = Number(p.rows[0]?.c ?? 0);
    const r = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM events WHERE status = 'retry_pending'`,
    );
    retryPending = Number(r.rows[0]?.c ?? 0);
    const d = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM dead_letter_events`);
    deadLetters = Number(d.rows[0]?.c ?? 0);
  } catch {
    /* tables may be absent in degraded env */
  }
  void pending;
  return { pending: pendingCount, retryPending, deadLetters };
}

export async function getErectorBlueprintReadiness(): Promise<{
  blueprintsTotal: number;
  blueprintsWithArchetype: number;
  activeMissingArchetype: number;
  archetypeRulePacks: number;
}> {
  const [total, withArch, activeMissing, packs] = await Promise.all([
    countTable("blueprints"),
    pool
      .query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM blueprints WHERE erector_archetype IS NOT NULL`,
      )
      .then((r) => Number(r.rows[0]?.c ?? 0))
      .catch(() => 0),
    pool
      .query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM blueprints
         WHERE active = true AND (erector_archetype IS NULL OR erector_archetype = '')`,
      )
      .then((r) => Number(r.rows[0]?.c ?? 0))
      .catch(() => 0),
    countTable("erector_archetype_rule_packs"),
  ]);
  return {
    blueprintsTotal: total ?? 0,
    blueprintsWithArchetype: withArch,
    activeMissingArchetype: activeMissing,
    archetypeRulePacks: packs ?? 0,
  };
}

export async function buildRuntimeReadinessReport(): Promise<{
  ok: boolean;
  databaseTarget: ReturnType<typeof buildSafeDatabaseTargetSnapshot> & {
    bindingSource: ReturnType<typeof resolveDatabaseUrlBindingSource>;
  };
  seeds: Awaited<ReturnType<typeof getErectorSeedStatus>>;
  indexes: Awaited<ReturnType<typeof getPartialIndexStatus>>;
  featureFlags: Awaited<ReturnType<typeof getFeatureFlagSnapshot>>;
  eventQueue: Awaited<ReturnType<typeof getEventQueueSummary>>;
  erectorBlueprint: Awaited<ReturnType<typeof getErectorBlueprintReadiness>>;
  schemaProbe: { ok: boolean };
}> {
  let schemaProbeOk = false;
  try {
    await pool.query("SELECT 1");
    schemaProbeOk = true;
  } catch {
    schemaProbeOk = false;
  }

  const [seeds, indexes, featureFlags, eventQueue, erectorBlueprint] = await Promise.all([
    getErectorSeedStatus(),
    getPartialIndexStatus(),
    getFeatureFlagSnapshot(),
    getEventQueueSummary(),
    getErectorBlueprintReadiness(),
  ]);

  const ok = schemaProbeOk && seeds.ok && indexes.ok;
  return {
    ok,
    databaseTarget: {
      ...buildSafeDatabaseTargetSnapshot(process.env.DATABASE_URL),
      bindingSource: resolveDatabaseUrlBindingSource(),
    },
    seeds,
    indexes,
    featureFlags,
    eventQueue,
    erectorBlueprint,
    schemaProbe: { ok: schemaProbeOk },
  };
}

/** Lightweight db-runtime snapshot for /api/debug/db-runtime */
export async function getDbRuntimeSnapshot() {
  const report = await buildRuntimeReadinessReport();
  return {
    ok: report.ok,
    bindingSource: report.databaseTarget.bindingSource,
    host: report.databaseTarget.host,
    port: report.databaseTarget.port,
    database: report.databaseTarget.database,
    configurationIssues: report.databaseTarget.configurationIssues,
    schemaProbe: report.schemaProbe,
    eventQueue: report.eventQueue,
  };
}

const REQUIRED_ERECTOR_TRIGGERS = [
  "ERECTOR_FREE_VALIDATION",
  "ERECTOR_PAID_VALIDATION",
  "ERECTOR_FREE_VERDICT_EXPLAIN",
  "ERECTOR_VERDICT_EXPLAIN",
] as const;

/** Bhudhi intelligence runtime snapshot — no secrets or user content. */
export async function getBhudhiRuntimeSnapshot(): Promise<{
  bhudhi_enabled: boolean;
  provider_configured: boolean;
  force_fallbacks: boolean;
  budget_controller_enabled: boolean;
  registered_triggers: number;
  erector_triggers_registered: boolean;
  allow_live_provider: boolean;
  runtime_mode: string;
  last_successful_call_at: string | null;
  last_call_at: string | null;
  last_validation_status: string | null;
  last_error_class: string | null;
}> {
  const { REGISTERED_TRIGGERS } = await import("./bhudhi/TriggerRegistry.js");
  const { isProviderConfigured, resolveBhudhiRuntimePolicy } = await import(
    "./bhudhi/BhudhiRuntimePolicy.js"
  );
  const { getContract } = await import("../bhudhi/PromptRegistry.js");

  const policy = await resolveBhudhiRuntimePolicy();
  const flags = await getFeatureFlagSnapshot();
  const forceFallbacks =
    flags.find((f) => f.feature_name === "bhudhi_force_fallbacks")?.enabled ?? false;
  const aiEnabled = flags.find((f) => f.feature_name === "ai_enabled")?.enabled ?? true;

  let lastRow: {
    validation_status: string | null;
    created_at: Date | string;
    fallback_used: boolean | null;
  } | null = null;
  try {
    const result = await pool.query<{
      validation_status: string | null;
      created_at: Date;
      fallback_used: boolean | null;
    }>(
      `SELECT validation_status, created_at, fallback_used
       FROM bhudhi_logs ORDER BY created_at DESC LIMIT 1`,
    );
    lastRow = result.rows[0] ?? null;
  } catch {
    lastRow = null;
  }

  const erectorRegistered = REQUIRED_ERECTOR_TRIGGERS.every(
    (t) => t in REGISTERED_TRIGGERS && getContract(t) !== null,
  );

  const lastStatus = lastRow?.validation_status ?? null;
  const lastAt = lastRow?.created_at
    ? lastRow.created_at instanceof Date
      ? lastRow.created_at.toISOString()
      : String(lastRow.created_at)
    : null;

  return {
    bhudhi_enabled: aiEnabled,
    provider_configured: isProviderConfigured(),
    force_fallbacks: forceFallbacks,
    budget_controller_enabled: true,
    registered_triggers: Object.keys(REGISTERED_TRIGGERS).length,
    erector_triggers_registered: erectorRegistered,
    allow_live_provider: policy.allowLiveProvider,
    runtime_mode: policy.mode,
    last_successful_call_at: lastStatus === "success" ? lastAt : null,
    last_call_at: lastAt,
    last_validation_status: lastStatus,
    last_error_class:
      lastStatus && lastStatus !== "success" && lastStatus !== "pending" ? lastStatus : null,
  };
}
