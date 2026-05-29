import { pool } from "@workspace/db";

type RequiredColumn = { table: string; column: string; detail?: string };

/** Columns required for POST /api/onboarding/goal. */
const REQUIRED_COLUMNS: RequiredColumn[] = [
  { table: "validations", column: "intelligence_payload" },
  { table: "validations", column: "validation_kind" },
  { table: "validations", column: "payload_version" },
  { table: "validations", column: "contract_id" },
  { table: "validations", column: "selected_path" },
  { table: "validations", column: "selected_path_type" },
  { table: "validations", column: "launch_blocked" },
  { table: "validations", column: "readiness" },
  { table: "validations", column: "blueprint_contract" },
  { table: "validations", column: "tier" },
  { table: "blueprints", column: "tier" },
  { table: "blueprints", column: "mode" },
  { table: "blueprints", column: "blueprint_tier" },
  { table: "blueprints", column: "primary_archetype_id" },
  { table: "blueprints", column: "reality_score" },
  { table: "blueprints", column: "erector_validation_id" },
  { table: "blueprints", column: "industry_state" },
  { table: "blueprints", column: "archetype_execution_mult" },
  { table: "blueprints", column: "archetype_timeframe_mult" },
  { table: "blueprints", column: "archetype_difficulty_adj" },
  { table: "blueprints", column: "intelligence_depth" },
  { table: "blueprints", column: "selection_confirmed_at" },
  { table: "blueprints", column: "blueprint_config" },
  { table: "blueprints", column: "validation_id" },
];

const REQUIRED_TABLES = [
  "eis_rate_limits",
  "eis_call_logs",
  "validation_event_logs",
  "validation_memory",
  "blueprint_sequences",
  "sequence_flows",
  "goal_sequences",
  "purpose_sequences",
  "context_sequences",
  "validation_sequences",
  "validation_result_sequences",
  "blueprint_tier_sequences",
  "policy_sequences",
  "master_plan_sequences",
  "signal_sequences",
  "mini_plan_sequences",
  "mini_plan_allocation_history",
  "orders",
  "execution_structure_sequences",
  "task_generation_sequences",
  "execution_feedback_sequences",
  "signal_condition_sequences",
  "prediction_scene_sequences",
];

const BLUEPRINT_LAUNCH_TABLES = [
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
  "state_memory",
  "knowledge_objects",
  "order_knowledge_links",
  "character_progression",
];

const BLUEPRINT_LAUNCH_COLUMNS: RequiredColumn[] = [
  { table: "blueprints", column: "id" },
  { table: "blueprints", column: "user_id" },
  { table: "blueprints", column: "validation_id" },
  { table: "blueprints", column: "goal", detail: "blueprints.goal maps to required raw_goal" },
  { table: "blueprints", column: "raw_goal" },
  { table: "blueprints", column: "purpose" },
  { table: "blueprints", column: "timeframe_days" },
  { table: "blueprints", column: "commitment_level" },
  { table: "blueprints", column: "domain" },
  { table: "blueprints", column: "location" },
  { table: "blueprints", column: "business_model" },
  { table: "blueprints", column: "online_offline" },
  { table: "blueprints", column: "budget" },
  { table: "blueprints", column: "current_resources" },
  { table: "blueprints", column: "target_customers" },
  { table: "blueprints", column: "target_profit" },
  { table: "blueprints", column: "selected_path" },
  { table: "blueprints", column: "selected_blueprint_level" },
  { table: "blueprints", column: "validation_verdict" },
  { table: "blueprints", column: "validation_scores" },
  { table: "blueprints", column: "validation_report" },
  { table: "blueprints", column: "path_options" },
  { table: "blueprints", column: "blueprint_options" },
  { table: "blueprints", column: "status" },
  { table: "blueprints", column: "active" },
  { table: "blueprints", column: "current_plan_id" },
  { table: "blueprints", column: "current_phase_id" },
  { table: "blueprints", column: "current_project_id" },
  { table: "blueprints", column: "current_action_id" },
  { table: "blueprints", column: "current_condition" },
  { table: "blueprints", column: "metadata" },
  { table: "blueprints", column: "created_at" },
  { table: "blueprints", column: "updated_at" },
  { table: "plans", column: "blueprint_id" },
  { table: "plans", column: "user_id" },
  { table: "plans", column: "name", detail: "plans.name maps to required title" },
  { table: "plans", column: "title" },
  { table: "plans", column: "description" },
  { table: "plans", column: "purpose" },
  { table: "plans", column: "outcome" },
  { table: "plans", column: "order_index" },
  { table: "plans", column: "status" },
  { table: "targets", column: "blueprint_id" },
  { table: "targets", column: "plan_id" },
  { table: "targets", column: "user_id" },
  { table: "targets", column: "name", detail: "targets.name maps to required title" },
  { table: "targets", column: "title" },
  { table: "targets", column: "target_type" },
  { table: "targets", column: "metric_name" },
  { table: "targets", column: "due_date" },
  { table: "phases", column: "blueprint_id" },
  { table: "phases", column: "plan_id" },
  { table: "phases", column: "user_id" },
  { table: "phases", column: "name", detail: "phases.name maps to required title" },
  { table: "phases", column: "title" },
  { table: "phases", column: "is_active" },
  { table: "phases", column: "progress_percent" },
  { table: "phases", column: "unlock_criteria" },
  { table: "projects", column: "blueprint_id" },
  { table: "projects", column: "phase_id" },
  { table: "projects", column: "user_id" },
  { table: "projects", column: "name", detail: "projects.name maps to required title" },
  { table: "projects", column: "title" },
  { table: "projects", column: "project_type" },
  { table: "projects", column: "progress_percent" },
  { table: "actions", column: "blueprint_id" },
  { table: "actions", column: "project_id" },
  { table: "actions", column: "target_id" },
  { table: "actions", column: "user_id" },
  { table: "actions", column: "name", detail: "actions.name maps to required title" },
  { table: "actions", column: "title" },
  { table: "actions", column: "action_type" },
  { table: "actions", column: "expected_output" },
  { table: "orders", column: "blueprint_id" },
  { table: "orders", column: "action_id" },
  { table: "orders", column: "user_id" },
  { table: "orders", column: "title" },
  { table: "orders", column: "instruction" },
  { table: "orders", column: "context_why" },
  { table: "orders", column: "expected_output" },
  { table: "orders", column: "order_type" },
  { table: "orders", column: "due_date" },
  { table: "orders", column: "condition_at_generation" },
  { table: "orders", column: "time_estimate_mins" },
  { table: "signal_snapshots", column: "blueprint_id" },
  { table: "signal_snapshots", column: "user_id" },
  { table: "signal_snapshots", column: "week_start" },
  { table: "signal_snapshots", column: "completion_rate" },
  { table: "signal_snapshots", column: "daily_score" },
  { table: "signal_snapshots", column: "momentum" },
  { table: "signal_snapshots", column: "condition" },
  { table: "conditions", column: "condition" },
  { table: "conditions", column: "reason" },
  { table: "conditions", column: "source" },
  { table: "enforcement_packages", column: "blueprint_id" },
  { table: "enforcement_packages", column: "user_id" },
  { table: "enforcement_packages", column: "condition" },
  { table: "enforcement_packages", column: "allowed_actions" },
  { table: "enforcement_packages", column: "restricted_actions" },
  { table: "enforcement_packages", column: "task_limits" },
  { table: "state_memory", column: "blueprint_id" },
  { table: "state_memory", column: "user_id" },
  { table: "state_memory", column: "current_state" },
  { table: "state_memory", column: "last_event" },
];

const BLUEPRINT_LAUNCH_INDEXES = [
  "idx_blueprints_user_id",
  "idx_orders_action_id",
  "idx_orders_blueprint_status",
  "idx_signal_snapshots_blueprint_current",
  "idx_enforcement_packages_blueprint_current",
  "idx_state_memory_blueprint_current",
];

export type SchemaVerifyResult = {
  ok: boolean;
  missingColumns: Array<{ table: string; column: string }>;
  missingTables: string[];
  missingIndexes: string[];
  detail?: string;
};

export type SchemaHealthResult = {
  ok: boolean;
  missing: string[];
};

/** Tables workers and schedulers touch on boot — must exist before the API stays up. */
export const RUNTIME_REQUIRED_TABLES = [
  "users",
  "sessions",
  "magic_link_tokens",
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
  "state_memory",
  "events",
  "event_logs",
  "dead_letter_events",
  "system_health_logs",
  "inactivity_records",
  "capability_profiles",
  "task_generation_logs",
  "notification_logs",
  "bhudhi_logs",
] as const;

/** Boot-critical columns (auth + core loop). Erector columns are checked separately. */
const BOOT_CRITICAL_COLUMNS: RequiredColumn[] = [
  { table: "users", column: "email" },
  { table: "sessions", column: "token_hash" },
  { table: "sessions", column: "expires_at" },
  { table: "validations", column: "selected_blueprint_tier" },
  { table: "validations", column: "selected_blueprint_mode" },
  { table: "validations", column: "location_context" },
  { table: "validations", column: "reality_context" },
  { table: "blueprints", column: "tier" },
  { table: "blueprints", column: "mode" },
  { table: "blueprints", column: "state_version" },
  { table: "orders", column: "command_context" },
  { table: "orders", column: "content_hash" },
];

/** Erector / blueprint-launch columns — warn at boot if missing; do not block auth. */
const EXTENDED_SCHEMA_COLUMNS: RequiredColumn[] = [
  { table: "blueprints", column: "blueprint_tier" },
  { table: "blueprints", column: "primary_archetype_id" },
  { table: "blueprints", column: "reality_score" },
  { table: "blueprints", column: "erector_validation_id" },
  { table: "blueprints", column: "industry_state" },
  { table: "blueprints", column: "archetype_execution_mult" },
  { table: "blueprints", column: "archetype_timeframe_mult" },
  { table: "blueprints", column: "archetype_difficulty_adj" },
  { table: "validations", column: "reality_score" },
  { table: "validations", column: "erector_validation_stage" },
];

async function checkColumns(columns: RequiredColumn[]): Promise<string[]> {
  const missing: string[] = [];
  for (const { table, column } of columns) {
    if (!(await hasTable(table))) continue;
    if (!(await hasColumn(table, column))) missing.push(`Missing column: ${table}.${column}`);
  }
  return missing;
}

/** Minimum schema for magic-link auth (AuthService uses users + sessions only). */
export const AUTH_BOOT_TABLES = ["users", "sessions"] as const;

export async function runAuthBootPreflight(): Promise<SchemaHealthResult> {
  const missing: string[] = [];
  for (const table of AUTH_BOOT_TABLES) {
    if (!(await hasTable(table))) missing.push(`Missing table: ${table}`);
  }
  const authColumns = BOOT_CRITICAL_COLUMNS.filter((c) =>
    AUTH_BOOT_TABLES.includes(c.table as (typeof AUTH_BOOT_TABLES)[number]),
  );
  missing.push(...(await checkColumns(authColumns)));
  return { ok: missing.length === 0, missing };
}

/** Tables + core columns required before the API listens (includes magic-link auth). */
export async function runRuntimeSchemaPreflight(): Promise<SchemaHealthResult> {
  const missing: string[] = [];
  for (const table of RUNTIME_REQUIRED_TABLES) {
    if (!(await hasTable(table))) missing.push(`Missing table: ${table}`);
  }
  missing.push(...(await checkColumns(BOOT_CRITICAL_COLUMNS)));
  return { ok: missing.length === 0, missing };
}

/** Erector feature columns — optional at boot so login still works while migrations catch up. */
export async function checkExtendedSchemaHealth(): Promise<SchemaHealthResult> {
  const missing: string[] = [];
  for (const table of RUNTIME_REQUIRED_TABLES) {
    if (!(await hasTable(table))) missing.push(`Missing table: ${table}`);
  }
  missing.push(...(await checkColumns(EXTENDED_SCHEMA_COLUMNS)));
  return { ok: missing.length === 0, missing };
}

async function hasTable(table: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return (r.rowCount ?? 0) > 0;
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return (r.rowCount ?? 0) > 0;
}

async function hasIndex(indexName: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = $1`,
    [indexName],
  );
  return (r.rowCount ?? 0) > 0;
}

function firstMissingDetail(
  missingTables: string[],
  missingColumns: Array<{ table: string; column: string }>,
  missingIndexes: string[],
): string | undefined {
  if (missingTables[0]) return `Missing table: ${missingTables[0]}`;
  if (missingColumns[0]) return `Missing column: ${missingColumns[0].table}.${missingColumns[0].column}`;
  if (missingIndexes[0]) return `Missing index: ${missingIndexes[0]}`;
  return undefined;
}

async function verifySchemaRequirements(tables: string[], columns: RequiredColumn[], indexes: string[] = []): Promise<SchemaVerifyResult> {
  const missingColumns: Array<{ table: string; column: string }> = [];
  const missingTables: string[] = [];
  const missingIndexes: string[] = [];

  for (const table of tables) {
    if (!(await hasTable(table))) missingTables.push(table);
  }

  for (const { table, column } of columns) {
    if (!missingTables.includes(table) && !(await hasColumn(table, column))) {
      missingColumns.push({ table, column });
    }
  }

  for (const indexName of indexes) {
    if (!(await hasIndex(indexName))) missingIndexes.push(indexName);
  }

  const detail = firstMissingDetail(missingTables, missingColumns, missingIndexes);
  return {
    ok: missingColumns.length === 0 && missingTables.length === 0 && missingIndexes.length === 0,
    missingColumns,
    missingTables,
    missingIndexes,
    detail,
  };
}

export async function verifyOnboardingSchema(): Promise<SchemaVerifyResult> {
  return verifySchemaRequirements(REQUIRED_TABLES, REQUIRED_COLUMNS);
}

/** Columns/tables required only for POST /api/onboarding/goal (not full Erector boot). */
const ONBOARDING_GOAL_TABLES = ["users", "blueprints", "validations"] as const;

const ONBOARDING_GOAL_COLUMNS: RequiredColumn[] = [
  { table: "validations", column: "intelligence_payload" },
  { table: "validations", column: "validation_kind" },
  { table: "validations", column: "payload_version" },
  { table: "validations", column: "contract_id" },
  { table: "validations", column: "selected_path" },
  { table: "validations", column: "selected_path_type" },
  { table: "validations", column: "launch_blocked" },
  { table: "validations", column: "readiness" },
  { table: "validations", column: "blueprint_contract" },
  { table: "validations", column: "tier" },
  { table: "blueprints", column: "tier" },
  { table: "blueprints", column: "mode" },
  { table: "blueprints", column: "raw_goal" },
  { table: "blueprints", column: "purpose" },
  { table: "blueprints", column: "timeframe_days" },
  { table: "blueprints", column: "commitment_level" },
];

export async function verifyOnboardingGoalSchema(): Promise<SchemaVerifyResult> {
  return verifySchemaRequirements([...ONBOARDING_GOAL_TABLES], ONBOARDING_GOAL_COLUMNS);
}

function schemaVerifyToHealth(result: SchemaVerifyResult): SchemaHealthResult {
  const missing = [
    ...result.missingTables.map((t) => `Missing table: ${t}`),
    ...result.missingColumns.map((c) => `Missing column: ${c.table}.${c.column}`),
  ];
  return { ok: result.ok, missing };
}

/** Preflight for POST /api/onboarding/goal — avoids blocking on optional Erector-only columns. */
export async function checkOnboardingGoalSchemaHealth(): Promise<SchemaHealthResult> {
  return schemaVerifyToHealth(await verifyOnboardingGoalSchema());
}

export async function verifyBlueprintLaunchSchema(): Promise<SchemaVerifyResult> {
  return verifySchemaRequirements(BLUEPRINT_LAUNCH_TABLES, BLUEPRINT_LAUNCH_COLUMNS, BLUEPRINT_LAUNCH_INDEXES);
}

export async function checkSchemaHealth(): Promise<SchemaHealthResult> {
  const core = await runRuntimeSchemaPreflight();
  const extended = await checkExtendedSchemaHealth();
  return {
    ok: core.ok && extended.ok,
    missing: [...core.missing, ...extended.missing],
  };
}
