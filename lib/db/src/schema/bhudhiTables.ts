/**
 * BHUDHI PROMPT 1 — Intelligence layer catalog + runtime records.
 * Drizzle schema (repo uses Drizzle, not Prisma).
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  doublePrecision,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { blueprints } from "./tables.js";

export const bhudhiSystems = pgTable(
  "bhudhi_systems",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description").notNull(),
    status: text("status").notNull().default("active"),
    last_analyzed_at: timestamp("last_analyzed_at", { withTimezone: true }),
    engine_count: integer("engine_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_systems_status").on(t.status)],
);

export const bhudhiEngines = pgTable(
  "bhudhi_engines",
  {
    id: text("id").primaryKey(),
    system_id: text("system_id")
      .notNull()
      .references(() => bhudhiSystems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("active"),
    last_run_at: timestamp("last_run_at", { withTimezone: true }),
    next_run_at: timestamp("next_run_at", { withTimezone: true }),
    configuration: jsonb("configuration").notNull().default(sql`'{}'::jsonb`),
    metrics: jsonb("metrics").notNull().default(sql`'{"executionsCount":0,"successRate":0,"averageExecutionTime":0,"lastResultCount":0}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_engines_system_id").on(t.system_id),
    index("idx_bhudhi_engines_status").on(t.status),
    uniqueIndex("uniq_bhudhi_engines_system_name").on(t.system_id, t.name),
  ],
);

export const bhudhiFrameworks = pgTable(
  "bhudhi_frameworks",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    domains: jsonb("domains").notNull().default(sql`'[]'::jsonb`),
    status: text("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    logic: jsonb("logic").notNull().default(sql`'{}'::jsonb`),
    accuracy: doublePrecision("accuracy").notNull().default(0.5),
    confidence_threshold: doublePrecision("confidence_threshold").notNull().default(0.7),
    improvement_history: jsonb("improvement_history").notNull().default(sql`'[]'::jsonb`),
    weekly_accuracy: jsonb("weekly_accuracy").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_frameworks_status").on(t.status)],
);

export const bhudhiDomains = pgTable(
  "bhudhi_domains",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description").notNull(),
    active_frameworks: jsonb("active_frameworks").notNull().default(sql`'[]'::jsonb`),
    framework_roles: jsonb("framework_roles").notNull().default(sql`'{}'::jsonb`),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const bhudhiSignals = pgTable(
  "bhudhi_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    global_signal: text("global_signal").notNull(),
    global_signal_confidence: doublePrecision("global_signal_confidence").notNull().default(0.5),
    framework_signals: jsonb("framework_signals").notNull().default(sql`'{}'::jsonb`),
    metrics: jsonb("metrics").notNull().default(sql`'{}'::jsonb`),
    execution_score: doublePrecision("execution_score"),
    momentum: doublePrecision("momentum"),
    feedback_confidence: doublePrecision("feedback_confidence"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_signals_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiInvestigations = pgTable(
  "bhudhi_investigations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    engine_id: text("engine_id")
      .notNull()
      .references(() => bhudhiEngines.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    findings: jsonb("findings").notNull().default(sql`'{}'::jsonb`),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    severity: text("severity").notNull().default("low"),
    actionable: boolean("actionable").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_investigations_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_investigations_engine_id").on(t.engine_id),
  ],
);

export const bhudhiRecommendations = pgTable(
  "bhudhi_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    engine_id: text("engine_id")
      .notNull()
      .references(() => bhudhiEngines.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    reasoning: text("reasoning").notNull(),
    expected_impact: jsonb("expected_impact").notNull().default(sql`'{}'::jsonb`),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    implementation_difficulty: text("implementation_difficulty").notNull().default("medium"),
    status: text("status").notNull().default("pending"),
    applied_at: timestamp("applied_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_recommendations_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_recommendations_engine_id").on(t.engine_id),
  ],
);

export const bhudhiExecutionEvents = pgTable(
  "bhudhi_execution_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    description: text("description").notNull(),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    learnings_generated: jsonb("learnings_generated").notNull().default(sql`'[]'::jsonb`),
    frameworks_improved: jsonb("frameworks_improved").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_execution_events_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiFrameworkLearning = pgTable(
  "bhudhi_framework_learning",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    framework_id: text("framework_id")
      .notNull()
      .references(() => bhudhiFrameworks.id, { onDelete: "cascade" }),
    learning_type: text("learning_type").notNull(),
    previous_accuracy: doublePrecision("previous_accuracy").notNull(),
    new_accuracy: doublePrecision("new_accuracy").notNull(),
    improvement: doublePrecision("improvement").notNull(),
    source_event: uuid("source_event"),
    evidence: jsonb("evidence").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("pending_validation"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_framework_learning_framework_id").on(t.framework_id)],
);

export const bhudhiExternalConnections = pgTable(
  "bhudhi_external_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    system_name: text("system_name").notNull(),
    system_type: text("system_type").notNull(),
    api_key_encrypted: text("api_key_encrypted"),
    api_endpoint: text("api_endpoint"),
    credentials_encrypted: text("credentials_encrypted"),
    sync_frequency: text("sync_frequency").notNull().default("daily"),
    last_sync_at: timestamp("last_sync_at", { withTimezone: true }),
    next_sync_at: timestamp("next_sync_at", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    error_message: text("error_message"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_external_connections_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiExternalData = pgTable(
  "bhudhi_external_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connection_id: uuid("connection_id")
      .notNull()
      .references(() => bhudhiExternalConnections.id, { onDelete: "cascade" }),
    data_type: text("data_type").notNull(),
    raw_data: jsonb("raw_data").notNull().default(sql`'{}'::jsonb`),
    normalized_data: jsonb("normalized_data").notNull().default(sql`'{}'::jsonb`),
    investigation_ids: jsonb("investigation_ids").notNull().default(sql`'[]'::jsonb`),
    insights: jsonb("insights").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_external_data_connection_id").on(t.connection_id)],
);

/** BHUDHI PROMPT 13 — 8 Torgima AI modules + runtime artifacts */
export const bhudhiModules = pgTable(
  "bhudhi_modules",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    system: text("system").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("active"),
    inputs: jsonb("inputs").notNull().default(sql`'{}'::jsonb`),
    outputs: jsonb("outputs").notNull().default(sql`'{}'::jsonb`),
    logic: jsonb("logic").notNull().default(sql`'{}'::jsonb`),
    accuracy: doublePrecision("accuracy").notNull().default(0.75),
    execution_time_ms: integer("execution_time_ms").notNull().default(0),
    last_run_at: timestamp("last_run_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_modules_system").on(t.system)],
);

export const bhudhiContextStates = pgTable(
  "bhudhi_context_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    current_domain: text("current_domain").notNull(),
    current_phase: text("current_phase").notNull(),
    resources: jsonb("resources").notNull().default(sql`'{}'::jsonb`),
    constraints: jsonb("constraints").notNull().default(sql`'[]'::jsonb`),
    urgency: text("urgency").notNull(),
    clarity: doublePrecision("clarity").notNull().default(0.5),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_context_states_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiIdeaSets = pgTable(
  "bhudhi_idea_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    problem: text("problem").notNull(),
    ideas: jsonb("ideas").notNull().default(sql`'[]'::jsonb`),
    feasibility: jsonb("feasibility").notNull().default(sql`'[]'::jsonb`),
    top_idea: text("top_idea"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_idea_sets_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiStrategicChoices = pgTable(
  "bhudhi_strategic_choices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    options: jsonb("options").notNull().default(sql`'[]'::jsonb`),
    selected: text("selected").notNull(),
    reasoning: text("reasoning").notNull(),
    alignment: doublePrecision("alignment").notNull().default(0.5),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_strategic_choices_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiPredictions = pgTable(
  "bhudhi_predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    scenario: text("scenario").notNull(),
    forecast: jsonb("forecast").notNull().default(sql`'{}'::jsonb`),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    timeline: integer("timeline").notNull().default(0),
    risks: jsonb("risks").notNull().default(sql`'[]'::jsonb`),
    opportunities: jsonb("opportunities").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_predictions_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiExecutionPlans = pgTable(
  "bhudhi_execution_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    recommendation_id: uuid("recommendation_id"),
    steps: jsonb("steps").notNull().default(sql`'[]'::jsonb`),
    timeline: jsonb("timeline").notNull().default(sql`'{}'::jsonb`),
    resources: jsonb("resources").notNull().default(sql`'{}'::jsonb`),
    dependencies: jsonb("dependencies").notNull().default(sql`'[]'::jsonb`),
    monitoring: jsonb("monitoring").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("planned"),
    progress: integer("progress").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_execution_plans_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_execution_plans_recommendation_id").on(t.recommendation_id),
  ],
);

/** BHUDHI Governance Engine — immutable audit + approvals (separate from user memory) */
export const bhudhiGovernanceAudit = pgTable(
  "bhudhi_governance_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "set null" }),
    event_type: text("event_type").notNull(),
    actor_type: text("actor_type").notNull(),
    actor_id: text("actor_id").notNull(),
    action: text("action").notNull(),
    decision: text("decision").notNull(),
    reasoning: text("reasoning").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    memory_refs: jsonb("memory_refs").notNull().default(sql`'[]'::jsonb`),
    approval_id: uuid("approval_id"),
    result: text("result"),
    rollback_id: uuid("rollback_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_governance_audit_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_governance_audit_event_type").on(t.event_type),
    index("idx_bhudhi_governance_audit_created_at").on(t.created_at),
  ],
);

export const bhudhiGovernanceApprovals = pgTable(
  "bhudhi_governance_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    subject_type: text("subject_type").notNull(),
    subject_id: text("subject_id").notNull(),
    action: text("action").notNull(),
    level: text("level").notNull(),
    status: text("status").notNull().default("pending"),
    approver_type: text("approver_type"),
    approver_id: text("approver_id"),
    rejection_reason: text("rejection_reason"),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_governance_approvals_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_governance_approvals_status").on(t.status),
    index("idx_bhudhi_governance_approvals_subject").on(t.subject_type, t.subject_id),
  ],
);

export const bhudhiGovernanceViolations = pgTable(
  "bhudhi_governance_violations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "set null" }),
    actor_type: text("actor_type").notNull(),
    actor_id: text("actor_id").notNull(),
    action: text("action").notNull(),
    violation_type: text("violation_type").notNull(),
    severity: text("severity").notNull(),
    detail: text("detail").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_governance_violations_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiGovernanceEmergency = pgTable(
  "bhudhi_governance_emergency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    trigger: text("trigger").notNull(),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    activated_at: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
    cleared_at: timestamp("cleared_at", { withTimezone: true }),
  },
  (t) => [index("idx_bhudhi_governance_emergency_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiGovernanceMemory = pgTable(
  "bhudhi_governance_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "cascade" }),
    memory_type: text("memory_type").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_governance_memory_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_governance_memory_type_key").on(t.memory_type, t.key),
  ],
);

/** BHUDHI PROMPT 15 — Intelligence Economics Engine (BIEE) */
export const bhudhiEconomicsProfiles = pgTable(
  "bhudhi_economics_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull(),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "cascade" }),
    daily_token_budget: integer("daily_token_budget").notNull().default(100000),
    daily_usd_budget: doublePrecision("daily_usd_budget").notNull().default(5),
    target_confidence: doublePrecision("target_confidence").notNull().default(0.8),
    execution_mode: text("execution_mode").notNull().default("STANDARD"),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_economics_profiles_user_id").on(t.user_id),
    index("idx_bhudhi_economics_profiles_blueprint_id").on(t.blueprint_id),
  ],
);

export const bhudhiModelCapabilities = pgTable(
  "bhudhi_model_capabilities",
  {
    id: text("id").primaryKey(),
    model_id: text("model_id").notNull().unique(),
    provider: text("provider").notNull(),
    cost_per_million: doublePrecision("cost_per_million").notNull(),
    latency_ms: integer("latency_ms").notNull().default(3000),
    quality: doublePrecision("quality").notNull().default(0.75),
    risk: doublePrecision("risk").notNull().default(0.2),
    reliability: doublePrecision("reliability").notNull().default(0.85),
    memory_fit: doublePrecision("memory_fit").notNull().default(0.7),
    tool_fit: doublePrecision("tool_fit").notNull().default(0.5),
    simulation_fit: doublePrecision("simulation_fit").notNull().default(0.5),
    status: text("status").notNull().default("active"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const bhudhiEconomicsRules = pgTable(
  "bhudhi_economics_rules",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    priority: integer("priority").notNull().default(100),
    condition: jsonb("condition").notNull().default(sql`'{}'::jsonb`),
    action: jsonb("action").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("active"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const bhudhiEconomicsSessions = pgTable(
  "bhudhi_economics_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull(),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "set null" }),
    trigger_type: text("trigger_type").notNull(),
    execution_mode: text("execution_mode").notNull(),
    route: text("route").notNull(),
    model_id: text("model_id").notNull(),
    estimated_cost_usd: doublePrecision("estimated_cost_usd").notNull().default(0),
    actual_cost_usd: doublePrecision("actual_cost_usd"),
    estimated_latency_ms: integer("estimated_latency_ms").notNull().default(0),
    actual_latency_ms: integer("actual_latency_ms"),
    tokens_in: integer("tokens_in").notNull().default(0),
    tokens_out: integer("tokens_out").notNull().default(0),
    confidence_target: doublePrecision("confidence_target").notNull().default(0.8),
    value_score: doublePrecision("value_score").notNull().default(0),
    cache_hit: boolean("cache_hit").notNull().default(false),
    roi_action: text("roi_action"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_economics_sessions_user_id").on(t.user_id),
    index("idx_bhudhi_economics_sessions_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_economics_sessions_created_at").on(t.created_at),
  ],
);

export const bhudhiEconomicsLogs = pgTable(
  "bhudhi_economics_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    session_id: uuid("session_id").references(() => bhudhiEconomicsSessions.id, { onDelete: "set null" }),
    user_id: uuid("user_id").notNull(),
    event_type: text("event_type").notNull(),
    category: text("category").notNull(),
    amount_usd: doublePrecision("amount_usd").notNull().default(0),
    tokens: integer("tokens").notNull().default(0),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_economics_logs_user_id").on(t.user_id),
    index("idx_bhudhi_economics_logs_session_id").on(t.session_id),
  ],
);

export const bhudhiEconomicsForecasts = pgTable(
  "bhudhi_economics_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull(),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "cascade" }),
    horizon_days: integer("horizon_days").notNull(),
    forecast_cost_usd: doublePrecision("forecast_cost_usd").notNull(),
    forecast_tokens: integer("forecast_tokens").notNull(),
    forecast_requests: integer("forecast_requests").notNull(),
    forecast_memory_mb: doublePrecision("forecast_memory_mb").notNull().default(0),
    forecast_simulation_hours: doublePrecision("forecast_simulation_hours").notNull().default(0),
    confidence: doublePrecision("confidence").notNull().default(0.7),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_economics_forecasts_user_id").on(t.user_id),
    index("idx_bhudhi_economics_forecasts_horizon").on(t.horizon_days),
  ],
);

/** BHUDHI PROMPT 16 — Decision Intelligence Engine (BDIE) */
export const bhudhiDecisionRecords = pgTable(
  "bhudhi_decision_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    recommendation_id: uuid("recommendation_id"),
    trigger: text("trigger").notNull(),
    goal: text("goal").notNull(),
    context: jsonb("context").notNull().default(sql`'{}'::jsonb`),
    selected_option_id: text("selected_option_id"),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    confidence_level: text("confidence_level").notNull().default("MEDIUM"),
    explanation: text("explanation").notNull(),
    status: text("status").notNull().default("pending"),
    approval_status: text("approval_status").notNull().default("pending"),
    governance_escalated: boolean("governance_escalated").notNull().default(false),
    actual_outcome: jsonb("actual_outcome"),
    regret_score: doublePrecision("regret_score"),
    quality_score: doublePrecision("quality_score"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_decision_records_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_decision_records_recommendation_id").on(t.recommendation_id),
    index("idx_bhudhi_decision_records_status").on(t.status),
  ],
);

export const bhudhiDecisionOptions = pgTable(
  "bhudhi_decision_options",
  {
    id: text("id").notNull(),
    decision_id: uuid("decision_id")
      .notNull()
      .references(() => bhudhiDecisionRecords.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    option_type: text("option_type").notNull(),
    description: text("description").notNull(),
    cost: doublePrecision("cost").notNull().default(0),
    timeline_days: integer("timeline_days").notNull().default(0),
    risk: doublePrecision("risk").notNull().default(0.5),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    expected_value: doublePrecision("expected_value").notNull().default(0),
    selected: boolean("selected").notNull().default(false),
    tradeoffs: jsonb("tradeoffs").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_decision_options_decision_id").on(t.decision_id),
    primaryKey({ columns: [t.decision_id, t.id] }),
  ],
);

export const bhudhiDecisionForecasts = pgTable(
  "bhudhi_decision_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decision_id: uuid("decision_id")
      .notNull()
      .references(() => bhudhiDecisionRecords.id, { onDelete: "cascade" }),
    horizon_days: integer("horizon_days").notNull(),
    best_outcome: doublePrecision("best_outcome").notNull(),
    expected_outcome: doublePrecision("expected_outcome").notNull(),
    worst_outcome: doublePrecision("worst_outcome").notNull(),
    probabilities: jsonb("probabilities").notNull().default(sql`'{}'::jsonb`),
    scenario_tree: jsonb("scenario_tree").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_decision_forecasts_decision_id").on(t.decision_id)],
);

export const bhudhiDecisionScores = pgTable(
  "bhudhi_decision_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decision_id: uuid("decision_id")
      .notNull()
      .references(() => bhudhiDecisionRecords.id, { onDelete: "cascade" }),
    option_id: text("option_id").notNull(),
    expected_value: doublePrecision("expected_value").notNull(),
    regret: doublePrecision("regret").notNull().default(0),
    upside: doublePrecision("upside").notNull().default(0),
    downside: doublePrecision("downside").notNull().default(0),
    recommendation: text("recommendation").notNull(),
    tradeoff_matrix: jsonb("tradeoff_matrix").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_decision_scores_decision_id").on(t.decision_id)],
);

export const bhudhiDecisionReplay = pgTable(
  "bhudhi_decision_replay",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decision_id: uuid("decision_id")
      .notNull()
      .references(() => bhudhiDecisionRecords.id, { onDelete: "cascade" }),
    replay_type: text("replay_type").notNull(),
    branch_option_id: text("branch_option_id"),
    what_happened: text("what_happened").notNull(),
    what_should_happen: text("what_should_happen").notNull(),
    what_would_happen: text("what_would_happen").notNull(),
    learnings: jsonb("learnings").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_decision_replay_decision_id").on(t.decision_id)],
);

/** BHUDHI PROMPT 17 — Belief Architecture Engine (BBAE) */
export const bhudhiBeliefRecords = pgTable(
  "bhudhi_belief_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id"),
    trigger: text("trigger"),
    belief_type: text("belief_type").notNull(),
    statement: text("statement").notNull(),
    origin: text("origin").notNull(),
    state: text("state").notNull().default("OBSERVED"),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    evidence: jsonb("evidence").notNull().default(sql`'[]'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    truth_score: doublePrecision("truth_score"),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_belief_records_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_belief_records_state").on(t.state),
    index("idx_bhudhi_belief_records_belief_type").on(t.belief_type),
  ],
);

export const bhudhiBeliefEvidence = pgTable(
  "bhudhi_belief_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    belief_id: uuid("belief_id")
      .notNull()
      .references(() => bhudhiBeliefRecords.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    reliability: doublePrecision("reliability").notNull().default(0.5),
    recency: doublePrecision("recency").notNull().default(0.5),
    agreement: doublePrecision("agreement").notNull().default(0.5),
    repeatability: doublePrecision("repeatability").notNull().default(0.5),
    evidence_score: doublePrecision("evidence_score").notNull().default(0.5),
    strength: text("strength").notNull().default("moderate"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_belief_evidence_belief_id").on(t.belief_id)],
);

export const bhudhiBeliefHistory = pgTable(
  "bhudhi_belief_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    belief_id: uuid("belief_id")
      .notNull()
      .references(() => bhudhiBeliefRecords.id, { onDelete: "cascade" }),
    change_type: text("change_type").notNull(),
    previous_state: text("previous_state"),
    new_state: text("new_state").notNull(),
    reason: text("reason").notNull(),
    confidence_before: doublePrecision("confidence_before"),
    confidence_after: doublePrecision("confidence_after"),
    quality_score: doublePrecision("quality_score"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_belief_history_belief_id").on(t.belief_id)],
);

export const bhudhiBeliefTruth = pgTable(
  "bhudhi_belief_truth",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    belief_id: uuid("belief_id")
      .notNull()
      .references(() => bhudhiBeliefRecords.id, { onDelete: "cascade" }),
    truth_score: doublePrecision("truth_score").notNull(),
    stability: doublePrecision("stability").notNull().default(0.5),
    certainty: doublePrecision("certainty").notNull().default(0.5),
    category: text("category").notNull().default("LOCAL"),
    conflicts: jsonb("conflicts").notNull().default(sql`'[]'::jsonb`),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_belief_truth_belief_id").on(t.belief_id)],
);

export const bhudhiBeliefConflicts = pgTable(
  "bhudhi_belief_conflicts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    belief_id_a: uuid("belief_id_a").references(() => bhudhiBeliefRecords.id, { onDelete: "set null" }),
    belief_id_b: uuid("belief_id_b").references(() => bhudhiBeliefRecords.id, { onDelete: "set null" }),
    conflict_type: text("conflict_type").notNull(),
    description: text("description").notNull(),
    action: text("action").notNull().default("investigate"),
    resolved: boolean("resolved").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_belief_conflicts_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 18 — World Model Engine (BWME) */
export const bhudhiWorldEntities = pgTable(
  "bhudhi_world_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    entity_type: text("entity_type").notNull(),
    label: text("label").notNull(),
    state: jsonb("state").notNull().default(sql`'{}'::jsonb`),
    relationships: jsonb("relationships").notNull().default(sql`'[]'::jsonb`),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_world_entities_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_world_entities_entity_type").on(t.entity_type),
  ],
);

export const bhudhiWorldStates = pgTable(
  "bhudhi_world_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    entity_id: uuid("entity_id").references(() => bhudhiWorldEntities.id, { onDelete: "cascade" }),
    state_type: text("state_type").notNull().default("DYNAMIC"),
    before_state: jsonb("before_state").notNull().default(sql`'{}'::jsonb`),
    after_state: jsonb("after_state").notNull().default(sql`'{}'::jsonb`),
    predicted_state: jsonb("predicted_state"),
    desired_state: jsonb("desired_state"),
    delta: jsonb("delta").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_world_states_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_world_states_entity_id").on(t.entity_id),
  ],
);

export const bhudhiWorldRelationships = pgTable(
  "bhudhi_world_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    from_entity_id: uuid("from_entity_id")
      .notNull()
      .references(() => bhudhiWorldEntities.id, { onDelete: "cascade" }),
    to_entity_id: uuid("to_entity_id")
      .notNull()
      .references(() => bhudhiWorldEntities.id, { onDelete: "cascade" }),
    relation_type: text("relation_type").notNull(),
    weight: doublePrecision("weight").notNull().default(1),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_world_relationships_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiWorldEvents = pgTable(
  "bhudhi_world_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    entity_id: uuid("entity_id").references(() => bhudhiWorldEntities.id, { onDelete: "set null" }),
    cause: text("cause"),
    impact: doublePrecision("impact").notNull().default(0),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    occurred_at: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_world_events_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiWorldSnapshots = pgTable(
  "bhudhi_world_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    world_state: jsonb("world_state").notNull().default(sql`'{}'::jsonb`),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    changes: jsonb("changes").notNull().default(sql`'[]'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_world_snapshots_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 19 — Identity Intelligence Engine (BIIE) */
export const bhudhiIdentityProfiles = pgTable(
  "bhudhi_identity_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id"),
    execution_profile: text("execution_profile").notNull().default("Builder"),
    personality: jsonb("personality").notNull().default(sql`'{}'::jsonb`),
    capabilities: jsonb("capabilities").notNull().default(sql`'{}'::jsonb`),
    motivations: jsonb("motivations").notNull().default(sql`'{}'::jsonb`),
    identity_state: jsonb("identity_state").notNull().default(sql`'{}'::jsonb`),
    growth_direction: text("growth_direction"),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_identity_profiles_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_identity_profiles_user_id").on(t.user_id),
  ],
);

export const bhudhiIdentityValues = pgTable(
  "bhudhi_identity_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .notNull()
      .references(() => bhudhiIdentityProfiles.id, { onDelete: "cascade" }),
    value_key: text("value_key").notNull(),
    rank: integer("rank").notNull().default(0),
    protected: boolean("protected").notNull().default(false),
    temporary: boolean("temporary").notNull().default(false),
    weight: doublePrecision("weight").notNull().default(0.5),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_identity_values_profile_id").on(t.profile_id)],
);

export const bhudhiIdentityGrowth = pgTable(
  "bhudhi_identity_growth",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .notNull()
      .references(() => bhudhiIdentityProfiles.id, { onDelete: "cascade" }),
    current_state: text("current_state").notNull(),
    next_identity: text("next_identity"),
    maturity: doublePrecision("maturity").notNull().default(0.5),
    stability: doublePrecision("stability").notNull().default(0.5),
    recommended_transitions: jsonb("recommended_transitions").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_identity_growth_profile_id").on(t.profile_id)],
);

export const bhudhiIdentityHistory = pgTable(
  "bhudhi_identity_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id")
      .notNull()
      .references(() => bhudhiIdentityProfiles.id, { onDelete: "cascade" }),
    change_type: text("change_type").notNull(),
    previous_snapshot: jsonb("previous_snapshot"),
    new_snapshot: jsonb("new_snapshot").notNull().default(sql`'{}'::jsonb`),
    reason: text("reason").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_identity_history_profile_id").on(t.profile_id)],
);

export const bhudhiIdentityEvents = pgTable(
  "bhudhi_identity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    profile_id: uuid("profile_id").references(() => bhudhiIdentityProfiles.id, { onDelete: "set null" }),
    event_type: text("event_type").notNull(),
    description: text("description").notNull(),
    action: text("action"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_identity_events_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 20 — Organization Operating System (BOOS) */
export const bhudhiOrganizations = pgTable(
  "bhudhi_organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    organization_state: jsonb("organization_state").notNull().default(sql`'{}'::jsonb`),
    capacity: jsonb("capacity").notNull().default(sql`'{}'::jsonb`),
    alignment: doublePrecision("alignment").notNull().default(0.5),
    health_score: integer("health_score").notNull().default(50),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_organizations_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiOrganizationRoles = pgTable(
  "bhudhi_organization_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => bhudhiOrganizations.id, { onDelete: "cascade" }),
    user_id: uuid("user_id"),
    role_key: text("role_key").notNull(),
    authority_level: text("authority_level").notNull().default("MEMBER"),
    department: text("department"),
    permissions: jsonb("permissions").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_organization_roles_org_id").on(t.organization_id),
    index("idx_bhudhi_organization_roles_user_id").on(t.user_id),
  ],
);

export const bhudhiOrganizationHealth = pgTable(
  "bhudhi_organization_health",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => bhudhiOrganizations.id, { onDelete: "cascade" }),
    execution_score: doublePrecision("execution_score").notNull().default(0.5),
    culture_score: doublePrecision("culture_score").notNull().default(0.5),
    strategy_score: doublePrecision("strategy_score").notNull().default(0.5),
    risk_score: doublePrecision("risk_score").notNull().default(0.5),
    resilience_score: doublePrecision("resilience_score").notNull().default(0.5),
    overall_score: integer("overall_score").notNull().default(50),
    action: text("action"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_organization_health_org_id").on(t.organization_id)],
);

export const bhudhiOrganizationEvents = pgTable(
  "bhudhi_organization_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => bhudhiOrganizations.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    description: text("description").notNull(),
    action: text("action"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_organization_events_org_id").on(t.organization_id)],
);

export const bhudhiOrganizationMemory = pgTable(
  "bhudhi_organization_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => bhudhiOrganizations.id, { onDelete: "cascade" }),
    memory_type: text("memory_type").notNull(),
    snapshot: jsonb("snapshot").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_organization_memory_org_id").on(t.organization_id)],
);

/** BHUDHI PROMPT 21 — Experimentation Engine (BEE) */
export const bhudhiExperiments = pgTable(
  "bhudhi_experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    goal: text("goal").notNull(),
    hypothesis: jsonb("hypothesis").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("PENDING"),
    duration_days: integer("duration_days").notNull().default(7),
    sample_size: integer("sample_size").notNull().default(100),
    confidence_target: doublePrecision("confidence_target").notNull().default(0.95),
    success_criteria: jsonb("success_criteria").notNull().default(sql`'{}'::jsonb`),
    metrics: jsonb("metrics").notNull().default(sql`'[]'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_experiments_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_experiments_status").on(t.status),
  ],
);

export const bhudhiExperimentGroups = pgTable(
  "bhudhi_experiment_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experiment_id: uuid("experiment_id")
      .notNull()
      .references(() => bhudhiExperiments.id, { onDelete: "cascade" }),
    group_key: text("group_key").notNull(),
    label: text("label").notNull(),
    allocation_weight: doublePrecision("allocation_weight").notNull().default(0.25),
    exposure_count: integer("exposure_count").notNull().default(0),
    completion_count: integer("completion_count").notNull().default(0),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_experiment_groups_experiment_id").on(t.experiment_id)],
);

export const bhudhiExperimentResults = pgTable(
  "bhudhi_experiment_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experiment_id: uuid("experiment_id")
      .notNull()
      .references(() => bhudhiExperiments.id, { onDelete: "cascade" }),
    group_id: uuid("group_id").references(() => bhudhiExperimentGroups.id, { onDelete: "set null" }),
    delta: doublePrecision("delta").notNull().default(0),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    effect_size: doublePrecision("effect_size").notNull().default(0),
    verdict: text("verdict"),
    causal: jsonb("causal").notNull().default(sql`'{}'::jsonb`),
    measured_at: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_experiment_results_experiment_id").on(t.experiment_id)],
);

export const bhudhiExperimentMemory = pgTable(
  "bhudhi_experiment_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experiment_id: uuid("experiment_id")
      .notNull()
      .references(() => bhudhiExperiments.id, { onDelete: "cascade" }),
    memory_type: text("memory_type").notNull(),
    snapshot: jsonb("snapshot").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_experiment_memory_experiment_id").on(t.experiment_id)],
);

export const bhudhiExperimentPromotions = pgTable(
  "bhudhi_experiment_promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experiment_id: uuid("experiment_id")
      .notNull()
      .references(() => bhudhiExperiments.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    winner_group: text("winner_group"),
    confidence: doublePrecision("confidence").notNull(),
    repeatability: doublePrecision("repeatability").notNull(),
    governance_ok: boolean("governance_ok").notNull().default(false),
    reason: text("reason").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_experiment_promotions_experiment_id").on(t.experiment_id)],
);

/** BHUDHI PROMPT 22 — Temporal Intelligence Engine (BTIE) */
export const bhudhiTemporalTimelines = pgTable(
  "bhudhi_temporal_timelines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    goal: text("goal"),
    timeline: jsonb("timeline").notNull().default(sql`'[]'::jsonb`),
    ordering: jsonb("ordering").notNull().default(sql`'[]'::jsonb`),
    causes: jsonb("causes").notNull().default(sql`'[]'::jsonb`),
    health: doublePrecision("health").notNull().default(0.5),
    buffer_days: integer("buffer_days").notNull().default(0),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_temporal_timelines_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiTemporalWindows = pgTable(
  "bhudhi_temporal_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    window_type: text("window_type").notNull(),
    label: text("label").notNull(),
    starts_at: timestamp("starts_at", { withTimezone: true }),
    ends_at: timestamp("ends_at", { withTimezone: true }),
    score: integer("score").notNull().default(50),
    success_probability: doublePrecision("success_probability").notNull().default(0.5),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_temporal_windows_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiTemporalForecasts = pgTable(
  "bhudhi_temporal_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    horizon_days: integer("horizon_days").notNull(),
    forecast: jsonb("forecast").notNull().default(sql`'{}'::jsonb`),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    adjustments: jsonb("adjustments").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_temporal_forecasts_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiTemporalPatterns = pgTable(
  "bhudhi_temporal_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    pattern_type: text("pattern_type").notNull(),
    description: text("description").notNull(),
    momentum_mode: text("momentum_mode"),
    score: doublePrecision("score").notNull().default(0.5),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_temporal_patterns_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiTemporalHistory = pgTable(
  "bhudhi_temporal_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    time_state: jsonb("time_state").notNull().default(sql`'{}'::jsonb`),
    urgency: doublePrecision("urgency").notNull().default(0.5),
    recommendation: text("recommendation").notNull(),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_temporal_history_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 23 — Meta Governor Engine (BMGE) */
export const bhudhiGovernorEvents = pgTable(
  "bhudhi_governor_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    subsystem: text("subsystem"),
    action: text("action").notNull(),
    priority_level: text("priority_level"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_governor_events_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiGovernorAllocations = pgTable(
  "bhudhi_governor_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    resource_type: text("resource_type").notNull(),
    allocated: doublePrecision("allocated").notNull().default(0),
    waste: doublePrecision("waste").notNull().default(0),
    recommendation: text("recommendation"),
    allocation_map: jsonb("allocation_map").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_governor_allocations_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiGovernorRecovery = pgTable(
  "bhudhi_governor_recovery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    recovery_mode: text("recovery_mode").notNull(),
    target_subsystem: text("target_subsystem").notNull(),
    status: text("status").notNull().default("pending"),
    preserved_history: boolean("preserved_history").notNull().default(true),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_governor_recovery_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiGovernorHistory = pgTable(
  "bhudhi_governor_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    session_id: uuid("session_id").notNull(),
    priority_map: jsonb("priority_map").notNull().default(sql`'{}'::jsonb`),
    interventions: jsonb("interventions").notNull().default(sql`'[]'::jsonb`),
    execution_plan: jsonb("execution_plan").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_governor_history_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiGovernorHealth = pgTable(
  "bhudhi_governor_health",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    quality: doublePrecision("quality").notNull().default(0.5),
    drift: doublePrecision("drift").notNull().default(0),
    latency_ms: integer("latency_ms").notNull().default(0),
    coordination: doublePrecision("coordination").notNull().default(0.5),
    efficiency: doublePrecision("efficiency").notNull().default(0.5),
    system_health: text("system_health").notNull().default("stable"),
    metrics: jsonb("metrics").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_governor_health_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 24 — Reliability Engine (BRE) */
export const bhudhiReliabilityEvents = pgTable(
  "bhudhi_reliability_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    severity: text("severity"),
    health: doublePrecision("health").notNull().default(0.5),
    risk: doublePrecision("risk").notNull().default(0),
    failure_probability: doublePrecision("failure_probability").notNull().default(0),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_reliability_events_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiIncidentLogs = pgTable(
  "bhudhi_incident_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    incident_id: uuid("incident_id").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("open"),
    owner: text("owner"),
    sla_hours: integer("sla_hours"),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closed_at: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("idx_bhudhi_incident_logs_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiRollbackHistory = pgTable(
  "bhudhi_rollback_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    target: text("target").notNull(),
    mode: text("mode").notNull(),
    preserved_history: boolean("preserved_history").notNull().default(true),
    status: text("status").notNull().default("complete"),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_rollback_history_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiRecoveryRecords = pgTable(
  "bhudhi_recovery_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    strategy: text("strategy").notNull(),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    estimated_recovery_minutes: integer("estimated_recovery_minutes").notNull().default(5),
    status: text("status").notNull().default("pending"),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_recovery_records_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiSystemHealth = pgTable(
  "bhudhi_system_health",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    resilience_score: integer("resilience_score").notNull().default(50),
    uptime: doublePrecision("uptime").notNull().default(0.99),
    availability: doublePrecision("availability").notNull().default(0.99),
    continuity_mode: text("continuity_mode").notNull().default("ONLINE"),
    metrics: jsonb("metrics").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_system_health_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 25 — Security Engine (BSE) */
export const bhudhiSecurityEvents = pgTable(
  "bhudhi_security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    actor_id: text("actor_id"),
    trust_score: doublePrecision("trust_score").notNull().default(0.5),
    risk: doublePrecision("risk").notNull().default(0),
    decision: text("decision").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_security_events_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiTrustProfiles = pgTable(
  "bhudhi_trust_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    subject_id: text("subject_id").notNull(),
    trust_level: text("trust_level").notNull().default("LIMITED"),
    trust_score: doublePrecision("trust_score").notNull().default(0.5),
    reasons: jsonb("reasons").notNull().default(sql`'[]'::jsonb`),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_trust_profiles_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiThreatRecords = pgTable(
  "bhudhi_threat_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    threat: text("threat").notNull(),
    severity: text("severity").notNull(),
    containment: text("containment"),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("open"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_threat_records_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiPermissionHistory = pgTable(
  "bhudhi_permission_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    subject_id: text("subject_id").notNull(),
    permission: text("permission").notNull(),
    allowed: boolean("allowed").notNull().default(false),
    constraints: jsonb("constraints").notNull().default(sql`'[]'::jsonb`),
    approvals: jsonb("approvals").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_permission_history_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiSecretRegistry = pgTable(
  "bhudhi_secret_registry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    secret_key: text("secret_key").notNull(),
    secret_type: text("secret_type").notNull(),
    vault_ref: text("vault_ref").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    revoked: boolean("revoked").notNull().default(false),
    rotated_at: timestamp("rotated_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_secret_registry_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 26 — Infrastructure Intelligence Engine (BIIE) */
export const bhudhiInfraRuntime = pgTable(
  "bhudhi_infra_runtime",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    runtime_type: text("runtime_type").notNull(),
    health: doublePrecision("health").notNull().default(0.5),
    latency_ms: integer("latency_ms").notNull().default(0),
    throughput: doublePrecision("throughput").notNull().default(0),
    stability: doublePrecision("stability").notNull().default(0.5),
    recommendation: text("recommendation"),
    metrics: jsonb("metrics").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_infra_runtime_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiInfraCapacity = pgTable(
  "bhudhi_infra_capacity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    cpu: doublePrecision("cpu").notNull().default(0),
    memory: doublePrecision("memory").notNull().default(0),
    gpu: doublePrecision("gpu").notNull().default(0),
    storage: doublePrecision("storage").notNull().default(0),
    network: doublePrecision("network").notNull().default(0),
    utilization: doublePrecision("utilization").notNull().default(0),
    waste: doublePrecision("waste").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_infra_capacity_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiInfraDeployments = pgTable(
  "bhudhi_infra_deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    strategy: text("strategy").notNull(),
    status: text("status").notNull().default("pending"),
    rollback_available: boolean("rollback_available").notNull().default(true),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_infra_deployments_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiInfraEvents = pgTable(
  "bhudhi_infra_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    environment: text("environment").notNull(),
    risk: doublePrecision("risk").notNull().default(0),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_infra_events_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiInfraHealth = pgTable(
  "bhudhi_infra_health",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    availability: doublePrecision("availability").notNull().default(0.99),
    load: doublePrecision("load").notNull().default(0),
    error_rate: doublePrecision("error_rate").notNull().default(0),
    latency_p99_ms: integer("latency_p99_ms").notNull().default(0),
    metrics: jsonb("metrics").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_infra_health_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 27 — Team Intelligence Engine (BTIE) */
export const bhudhiTeams = pgTable(
  "bhudhi_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    team_state: jsonb("team_state").notNull().default(sql`'{}'::jsonb`),
    alignment: doublePrecision("alignment").notNull().default(0.5),
    capacity: jsonb("capacity").notNull().default(sql`'{}'::jsonb`),
    recommendation: text("recommendation"),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_teams_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiTeamIdentity = pgTable(
  "bhudhi_team_identity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id")
      .notNull()
      .references(() => bhudhiTeams.id, { onDelete: "cascade" }),
    mission: text("mission"),
    values: jsonb("values").notNull().default(sql`'[]'::jsonb`),
    strengths: jsonb("strengths").notNull().default(sql`'[]'::jsonb`),
    blindspots: jsonb("blindspots").notNull().default(sql`'[]'::jsonb`),
    working_style: text("working_style"),
    health: doublePrecision("health").notNull().default(0.5),
    drift: doublePrecision("drift").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_team_identity_team_id").on(t.team_id)],
);

export const bhudhiTeamMemory = pgTable(
  "bhudhi_team_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id")
      .notNull()
      .references(() => bhudhiTeams.id, { onDelete: "cascade" }),
    memory_type: text("memory_type").notNull(),
    content: jsonb("content").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_team_memory_team_id").on(t.team_id)],
);

export const bhudhiTeamAlignment = pgTable(
  "bhudhi_team_alignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id")
      .notNull()
      .references(() => bhudhiTeams.id, { onDelete: "cascade" }),
    goal_alignment: doublePrecision("goal_alignment").notNull().default(0.5),
    strategy_alignment: doublePrecision("strategy_alignment").notNull().default(0.5),
    identity_alignment: doublePrecision("identity_alignment").notNull().default(0.5),
    conflicts: jsonb("conflicts").notNull().default(sql`'[]'::jsonb`),
    recommendations: jsonb("recommendations").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_team_alignment_team_id").on(t.team_id)],
);

export const bhudhiTeamHealth = pgTable(
  "bhudhi_team_health",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id")
      .notNull()
      .references(() => bhudhiTeams.id, { onDelete: "cascade" }),
    score: integer("score").notNull().default(50),
    burnout: doublePrecision("burnout").notNull().default(0),
    load: doublePrecision("load").notNull().default(0),
    trust: doublePrecision("trust").notNull().default(0.5),
    momentum: doublePrecision("momentum").notNull().default(0.5),
    engagement: doublePrecision("engagement").notNull().default(0.5),
    action: text("action").notNull().default("none"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_team_health_team_id").on(t.team_id)],
);

/** BHUDHI PROMPT 28 — Erector Runtime Engine (BERE) */
export const bhudhiSimulationWorlds = pgTable(
  "bhudhi_simulation_worlds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    mode: text("mode").notNull().default("STANDARD"),
    seed: text("seed").notNull(),
    world: jsonb("world").notNull().default(sql`'{}'::jsonb`),
    realism: doublePrecision("realism").notNull().default(0.7),
    difficulty: doublePrecision("difficulty").notNull().default(0.5),
    volatility: doublePrecision("volatility").notNull().default(0.3),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_simulation_worlds_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiSimulationRuns = pgTable(
  "bhudhi_simulation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    simulation_id: uuid("simulation_id").notNull(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    world_id: uuid("world_id").references(() => bhudhiSimulationWorlds.id, { onDelete: "set null" }),
    goal: text("goal"),
    status: text("status").notNull().default("pending"),
    outcomes: jsonb("outcomes").notNull().default(sql`'{}'::jsonb`),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    recommendation: text("recommendation"),
    seed: text("seed").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_simulation_runs_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiSimulationScores = pgTable(
  "bhudhi_simulation_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    run_id: uuid("run_id")
      .notNull()
      .references(() => bhudhiSimulationRuns.id, { onDelete: "cascade" }),
    survival: integer("survival").notNull().default(50),
    goal_achievement: integer("goal_achievement").notNull().default(50),
    efficiency: integer("efficiency").notNull().default(50),
    resilience: integer("resilience").notNull().default(50),
    risk: integer("risk").notNull().default(50),
    overall: integer("overall").notNull().default(50),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_simulation_scores_run_id").on(t.run_id)],
);

export const bhudhiSimulationEvents = pgTable(
  "bhudhi_simulation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    run_id: uuid("run_id")
      .notNull()
      .references(() => bhudhiSimulationRuns.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_simulation_events_run_id").on(t.run_id)],
);

export const bhudhiSimulationMemory = pgTable(
  "bhudhi_simulation_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    memory_type: text("memory_type").notNull(),
    snapshot: jsonb("snapshot").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_simulation_memory_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 29 — Civilization Intelligence Engine (BCIE) */
export const bhudhiCivilizations = pgTable(
  "bhudhi_civilizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Blueprint Civilization"),
    civilization_state: jsonb("civilization_state").notNull().default(sql`'{}'::jsonb`),
    resilience: doublePrecision("resilience").notNull().default(0.5),
    trajectory: text("trajectory").notNull().default("stable"),
    evolution_mode: text("evolution_mode").notNull().default("stable"),
    seed: text("seed").notNull(),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_civilizations_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiCivilizationStates = pgTable(
  "bhudhi_civilization_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    civilization_id: uuid("civilization_id")
      .notNull()
      .references(() => bhudhiCivilizations.id, { onDelete: "cascade" }),
    phase: text("phase").notNull(),
    population_health: doublePrecision("population_health").notNull().default(0.5),
    institution_effectiveness: doublePrecision("institution_effectiveness").notNull().default(0.5),
    ecosystem_health: doublePrecision("ecosystem_health").notNull().default(0.5),
    economic_trajectory: text("economic_trajectory").notNull().default("stable"),
    resilience_score: integer("resilience_score").notNull().default(50),
    snapshot: jsonb("snapshot").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_civilization_states_civilization_id").on(t.civilization_id)],
);

export const bhudhiCivilizationEvents = pgTable(
  "bhudhi_civilization_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    civilization_id: uuid("civilization_id")
      .notNull()
      .references(() => bhudhiCivilizations.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_civilization_events_civilization_id").on(t.civilization_id)],
);

export const bhudhiCivilizationForecasts = pgTable(
  "bhudhi_civilization_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    civilization_id: uuid("civilization_id")
      .notNull()
      .references(() => bhudhiCivilizations.id, { onDelete: "cascade" }),
    horizon_years: integer("horizon_years").notNull(),
    trajectory: text("trajectory").notNull(),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    forecast: jsonb("forecast").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_civilization_forecasts_civilization_id").on(t.civilization_id)],
);

export const bhudhiCivilizationMemory = pgTable(
  "bhudhi_civilization_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    civilization_id: uuid("civilization_id").references(() => bhudhiCivilizations.id, { onDelete: "set null" }),
    memory_type: text("memory_type").notNull(),
    snapshot: jsonb("snapshot").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_civilization_memory_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 30 — AGI Expansion Engine (BAEE) */
export const bhudhiExpansionCapabilities = pgTable(
  "bhudhi_expansion_capabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    capability_key: text("capability_key").notNull(),
    origin: text("origin").notNull(),
    level: text("level").notNull().default("LOCAL"),
    status: text("status").notNull().default("candidate"),
    score: doublePrecision("score").notNull().default(0.5),
    risk: doublePrecision("risk").notNull().default(0.3),
    dependencies: jsonb("dependencies").notNull().default(sql`'[]'::jsonb`),
    snapshot: jsonb("snapshot").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_expansion_capabilities_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_expansion_capabilities_key").on(t.capability_key),
  ],
);

export const bhudhiExpansionEvents = pgTable(
  "bhudhi_expansion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    capability_id: uuid("capability_id").references(() => bhudhiExpansionCapabilities.id, { onDelete: "set null" }),
    event_type: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_expansion_events_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiExpansionBenchmarks = pgTable(
  "bhudhi_expansion_benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    capability_id: uuid("capability_id")
      .notNull()
      .references(() => bhudhiExpansionCapabilities.id, { onDelete: "cascade" }),
    gain: doublePrecision("gain").notNull().default(0),
    cost: doublePrecision("cost").notNull().default(0),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    benchmark: jsonb("benchmark").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_expansion_benchmarks_capability_id").on(t.capability_id)],
);

export const bhudhiExpansionHistory = pgTable(
  "bhudhi_expansion_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    capability_key: text("capability_key"),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_expansion_history_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiExpansionMemory = pgTable(
  "bhudhi_expansion_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    memory_type: text("memory_type").notNull(),
    snapshot: jsonb("snapshot").notNull().default(sql`'{}'::jsonb`),
    memory_class: text("memory_class").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_expansion_memory_blueprint_id").on(t.blueprint_id)],
);

/** BHUDHI PROMPT 31 — Unified Cognitive Kernel */
export const bhudhiKernelEvents = pgTable(
  "bhudhi_kernel_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    source_engine: text("source_engine").notNull(),
    target_engine: text("target_engine").notNull().default("broadcast"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("emitted"),
    processed_by: jsonb("processed_by").notNull().default(sql`'[]'::jsonb`),
    parent_event_id: uuid("parent_event_id"),
    chain_id: text("chain_id").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_kernel_events_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_kernel_events_event_type").on(t.event_type),
    index("idx_bhudhi_kernel_events_chain_id").on(t.chain_id),
  ],
);

export const bhudhiSharedContext = pgTable(
  "bhudhi_shared_context",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .unique()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    domain: text("domain").notNull().default("genesis"),
    phase: text("phase").notNull().default("initiation"),
    signal: text("signal").notNull().default("nothingness"),
    condition: text("condition").notNull().default("nothingness"),
    context: jsonb("context").notNull().default(sql`'{}'::jsonb`),
    ideas: jsonb("ideas").notNull().default(sql`'{}'::jsonb`),
    strategy: jsonb("strategy").notNull().default(sql`'{}'::jsonb`),
    predictions: jsonb("predictions").notNull().default(sql`'{}'::jsonb`),
    knowledge: jsonb("knowledge").notNull().default(sql`'{}'::jsonb`),
    behavior: jsonb("behavior").notNull().default(sql`'{}'::jsonb`),
    execution: jsonb("execution").notNull().default(sql`'{}'::jsonb`),
    investigations: jsonb("investigations").notNull().default(sql`'{}'::jsonb`),
    last_update_engine: text("last_update_engine").notNull().default("system"),
    last_update_time: timestamp("last_update_time", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_shared_context_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiEngineRegistry = pgTable(
  "bhudhi_engine_registry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engine_id: text("engine_id").notNull().unique(),
    engine_name: text("engine_name").notNull(),
    system: text("system").notNull(),
    accepts_events: jsonb("accepts_events").notNull().default(sql`'[]'::jsonb`),
    emits_events: jsonb("emits_events").notNull().default(sql`'[]'::jsonb`),
    requires_context: jsonb("requires_context").notNull().default(sql`'[]'::jsonb`),
    produces_context: jsonb("produces_context").notNull().default(sql`'[]'::jsonb`),
    status: text("status").notNull().default("active"),
    health_check: jsonb("health_check").notNull().default(sql`'{}'::jsonb`),
    last_active_at: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_engine_registry_system").on(t.system)],
);

export const bhudhiExecutionContracts = pgTable(
  "bhudhi_execution_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    contract_type: text("contract_type").notNull(),
    execution_id: text("execution_id").notNull(),
    input: jsonb("input").notNull().default(sql`'{}'::jsonb`),
    output: jsonb("output").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("pending"),
    started_at: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    duration_ms: integer("duration_ms"),
    event_chain_id: text("event_chain_id"),
    events: jsonb("events").notNull().default(sql`'[]'::jsonb`),
    error: text("error"),
    stack_trace: text("stack_trace"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_execution_contracts_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_execution_contracts_contract_type").on(t.contract_type),
    index("idx_bhudhi_execution_contracts_status").on(t.status),
  ],
);

/** BHUDHI PROMPT 32 — Unified Memory Graph */
export const bhudhiMemoryNodes = pgTable(
  "bhudhi_memory_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    node_type: text("node_type").notNull(),
    node_id: text("node_id").notNull(),
    content: jsonb("content").notNull().default(sql`'{}'::jsonb`),
    summary: text("summary").notNull(),
    source_engine: text("source_engine").notNull(),
    source_event: text("source_event"),
    confidence: doublePrecision("confidence").notNull().default(0.75),
    importance: doublePrecision("importance").notNull().default(0.5),
    verified: boolean("verified").notNull().default(false),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    access_count: integer("access_count").notNull().default(0),
    last_access_at: timestamp("last_access_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_memory_nodes_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_memory_nodes_node_type").on(t.node_type),
    uniqueIndex("uniq_bhudhi_memory_nodes_blueprint_type_id").on(
      t.blueprint_id,
      t.node_type,
      t.node_id,
    ),
  ],
);

export const bhudhiMemoryEdges = pgTable(
  "bhudhi_memory_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    from_node_id: uuid("from_node_id")
      .notNull()
      .references(() => bhudhiMemoryNodes.id, { onDelete: "cascade" }),
    to_node_id: uuid("to_node_id")
      .notNull()
      .references(() => bhudhiMemoryNodes.id, { onDelete: "cascade" }),
    edge_type: text("edge_type").notNull(),
    strength: doublePrecision("strength").notNull().default(0.7),
    bidirectional: boolean("bidirectional").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_memory_edges_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_memory_edges_from").on(t.from_node_id),
    index("idx_bhudhi_memory_edges_to").on(t.to_node_id),
    uniqueIndex("uniq_bhudhi_memory_edges").on(t.blueprint_id, t.from_node_id, t.to_node_id, t.edge_type),
  ],
);

export const bhudhiMemoryQueries = pgTable(
  "bhudhi_memory_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    node_types: jsonb("node_types").notNull().default(sql`'[]'::jsonb`),
    filters: jsonb("filters").notNull().default(sql`'{}'::jsonb`),
    results: jsonb("results").notNull().default(sql`'{}'::jsonb`),
    result_count: integer("result_count").notNull().default(0),
    execution_time_ms: integer("execution_time_ms").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expires_at: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [index("idx_bhudhi_memory_queries_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiMemoryTimeline = pgTable(
  "bhudhi_memory_timeline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    node_id: uuid("node_id").references(() => bhudhiMemoryNodes.id, { onDelete: "set null" }),
    event: text("event").notNull(),
    state: jsonb("state").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_memory_timeline_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_memory_timeline_timestamp").on(t.timestamp),
  ],
);

export const bhudhiMemoryRelationships = pgTable(
  "bhudhi_memory_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    node_id_1: uuid("node_id_1")
      .notNull()
      .references(() => bhudhiMemoryNodes.id, { onDelete: "cascade" }),
    node_id_2: uuid("node_id_2")
      .notNull()
      .references(() => bhudhiMemoryNodes.id, { onDelete: "cascade" }),
    relationship_type: text("relationship_type").notNull(),
    strength: doublePrecision("strength").notNull().default(0.7),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_memory_relationships_blueprint_id").on(t.blueprint_id)],
);

// --- BHUDHI PROMPT 33: Protocol Layer (BHUDHI://) ---

export const bhudhiProtocolMessages = pgTable(
  "bhudhi_protocol_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    version: text("version").notNull().default("1.0"),
    message_type: text("message_type").notNull(),
    from_engine: text("from_engine").notNull(),
    to_engine: text("to_engine").notNull().default("broadcast"),
    uri: text("uri").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    route_id: text("route_id").notNull(),
    sequence_number: integer("sequence_number").notNull().default(0),
    status: text("status").notNull().default("sent"),
    sent_at: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    processed_at: timestamp("processed_at", { withTimezone: true }),
    latency_ms: integer("latency_ms"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_protocol_messages_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_protocol_messages_uri").on(t.uri),
    index("idx_bhudhi_protocol_messages_from_engine").on(t.from_engine),
    index("idx_bhudhi_protocol_messages_to_engine").on(t.to_engine),
  ],
);

export const bhudhiProtocolRoutes = pgTable(
  "bhudhi_protocol_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pattern: text("pattern").notNull(),
    handler: text("handler").notNull(),
    request_schema: jsonb("request_schema").notNull().default(sql`'{}'::jsonb`),
    response_schema: jsonb("response_schema").notNull().default(sql`'{}'::jsonb`),
    async: boolean("async").notNull().default(true),
    timeout_ms: integer("timeout_ms").notNull().default(30000),
    retries: integer("retries").notNull().default(3),
    description: text("description").notNull().default(""),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idx_bhudhi_protocol_routes_pattern").on(t.pattern)],
);

export const bhudhiProtocolContracts = pgTable(
  "bhudhi_protocol_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engine_a: text("engine_a").notNull(),
    engine_b: text("engine_b").notNull(),
    message_types: jsonb("message_types").notNull().default(sql`'[]'::jsonb`),
    guarantees: jsonb("guarantees").notNull().default(sql`'[]'::jsonb`),
    active: boolean("active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idx_bhudhi_protocol_contracts_engines").on(t.engine_a, t.engine_b)],
);

// --- BHUDHI PROMPT 35: Unified Execution Runtime ---

export const bhudhiUnifiedExecutionContexts = pgTable(
  "bhudhi_unified_execution_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    execution_type: text("execution_type").notNull(),
    execution_id: text("execution_id").notNull(),
    action: text("action").notNull().default(""),
    input: jsonb("input").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    started_at: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    estimated_end: timestamp("estimated_end", { withTimezone: true }),
    output: jsonb("output").notNull().default(sql`'{}'::jsonb`),
    feedback: jsonb("feedback").notNull().default(sql`'{}'::jsonb`),
    errors: jsonb("errors").notNull().default(sql`'[]'::jsonb`),
    warnings: jsonb("warnings").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_bhudhi_unified_execution_contexts_execution_id").on(t.execution_id),
    index("idx_bhudhi_unified_execution_contexts_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_unified_execution_contexts_execution_type").on(t.execution_type),
    index("idx_bhudhi_unified_execution_contexts_status").on(t.status),
  ],
);

export const bhudhiUnifiedExecutionSteps = pgTable(
  "bhudhi_unified_execution_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execution_id: text("execution_id").notNull(),
    step_number: integer("step_number").notNull(),
    action: text("action").notNull(),
    status: text("status").notNull().default("pending"),
    depends_on: jsonb("depends_on").notNull().default(sql`'[]'::jsonb`),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    duration_ms: integer("duration_ms"),
    result: jsonb("result").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_bhudhi_unified_execution_steps_exec_step").on(t.execution_id, t.step_number),
    index("idx_bhudhi_unified_execution_steps_execution_id").on(t.execution_id),
  ],
);

export const bhudhiUnifiedExecutionFeedback = pgTable(
  "bhudhi_unified_execution_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execution_id: text("execution_id").notNull(),
    feedback_type: text("feedback_type").notNull(),
    message: text("message").notNull(),
    source: text("source").notNull(),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bhudhi_unified_execution_feedback_execution_id").on(t.execution_id)],
);

export const bhudhiUnifiedExecutionResults = pgTable(
  "bhudhi_unified_execution_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execution_id: text("execution_id").notNull(),
    success: boolean("success").notNull(),
    outcome: text("outcome").notNull(),
    metrics_accuracy: doublePrecision("metrics_accuracy").notNull().default(0),
    metrics_speed_ms: integer("metrics_speed_ms").notNull().default(0),
    metrics_quality: doublePrecision("metrics_quality").notNull().default(0),
    learnings: jsonb("learnings").notNull().default(sql`'{}'::jsonb`),
    improvements: jsonb("improvements").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_bhudhi_unified_execution_results_execution_id").on(t.execution_id),
    index("idx_bhudhi_unified_execution_results_success").on(t.success),
  ],
);
