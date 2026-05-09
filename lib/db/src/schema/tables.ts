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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  userModeEnum,
  userTierEnum,
  commitmentLevelEnum,
  blueprintStatusEnum,
  validationVerdictEnum,
  selectedPathEnum,
  domainEnum,
  seasonNameEnum,
  planStatusEnum,
  targetTypeEnum,
  targetStatusEnum,
  phaseNameEnum,
  phaseStatusEnum,
  projectTypeEnum,
  projectStatusEnum,
  actionTypeEnum,
  taskTypeEnum,
  difficultyEnum,
  proofTypeEnum,
  orderStatusEnum,
  conditionEnum,
  signalTrendEnum,
  signalConfidenceEnum,
  phasePermissionEnum,
  targetAdjustmentEnum,
  aiModeEnum,
  uiModeEnum,
  riskLevelEnum,
  eventStatusEnum,
  eventLogResultEnum,
  frameworkNameEnum,
  frameworkActivationLevelEnum,
  frameworkDecisionStatusEnum,
  bhudhiTriggerTypeEnum,
  bhudhiExecutionContextEnum,
  bhudhiRequestTypeEnum,
  capabilityLevelEnum,
  throughputEnum,
  fatigueRiskEnum,
  behaviorPatternTypeEnum,
  behaviorPatternStatusEnum,
  inactivityThresholdEnum,
  identityStageEnum,
  milestoneTypeEnum,
  generationTriggerEnum,
  generationModeEnum,
  domainTransitionTriggerEnum,
} from "./enums";

// ── GROUP 1 — IDENTITY & AUTH ───────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username"),
  display_name: text("display_name"),
  mode: userModeEnum("mode").notNull().default("individual"),
  tier: userTierEnum("tier").notNull().default("starter"),
  role_context: text("role_context"),
  domain_hint: text("domain_hint"),
  commitment_level: commitmentLevelEnum("commitment_level"),
  timezone: text("timezone").notNull().default("UTC"),
  onboarding_complete: boolean("onboarding_complete").notNull().default(false),
  active: boolean("active").notNull().default(true),
  notification_preferences: jsonb("notification_preferences")
    .notNull()
    .default(
      sql`'{"email_inactivity_reminder":true,"email_milestone_achieved":true,"email_blueprint_completed":true,"email_pivot_review_ready":true,"email_blueprint_paused":true,"email_weekly_summary":false,"email_all_disabled":false,"quiet_hours_enabled":false,"quiet_hours_start":"22:00","quiet_hours_end":"08:00"}'::jsonb`,
    ),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token_hash: text("token_hash").notNull().unique(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    last_used_at: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_sessions_user_id").on(t.user_id), index("idx_sessions_expires_at").on(t.expires_at)],
);

// ── GROUP 2 — BLUEPRINT CHAIN ───────────────────────────────────────────────

export const validations = pgTable(
  "validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").notNull(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verdict: validationVerdictEnum("verdict"),
    ai_summary: text("ai_summary"),
    feasibility_score: doublePrecision("feasibility_score"),
    clarity_score: doublePrecision("clarity_score"),
    realism_score: doublePrecision("realism_score"),
    path_current: jsonb("path_current"),
    path_adjusted: jsonb("path_adjusted"),
    path_alternative: jsonb("path_alternative"),
    selected_path: selectedPathEnum("selected_path"),
    selected_at: timestamp("selected_at", { withTimezone: true }),
    status: text("status").notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_validations_blueprint_id").on(t.blueprint_id)],
);

export const bhudhiLogs = pgTable(
  "bhudhi_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => users.id),
    blueprint_id: uuid("blueprint_id"),
    order_id: uuid("order_id"),
    request_type: bhudhiRequestTypeEnum("request_type").notNull(),
    trigger_type: bhudhiTriggerTypeEnum("trigger_type"),
    response_type: text("response_type"),
    execution_context: bhudhiExecutionContextEnum("execution_context"),
    input_json: jsonb("input_json").notNull().default(sql`'{}'::jsonb`),
    prompt_version: text("prompt_version"),
    model_used: text("model_used"),
    output_json: jsonb("output_json"),
    raw_response: text("raw_response"),
    validation_status: text("validation_status"),
    validation_notes: text("validation_notes"),
    output_schema_valid: boolean("output_schema_valid").notNull().default(true),
    authority_language_detected: boolean("authority_language_detected").notNull().default(false),
    latency_ms: integer("latency_ms"),
    token_count_in: integer("token_count_in"),
    token_count_out: integer("token_count_out"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bhudhi_logs_user_id").on(t.user_id),
    index("idx_bhudhi_logs_blueprint_id").on(t.blueprint_id),
    index("idx_bhudhi_logs_request_type").on(t.request_type),
  ],
);

export const blueprints = pgTable(
  "blueprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    goal: text("goal").notNull(),
    purpose: text("purpose"),
    timeframe_start: timestamp("timeframe_start", { withTimezone: true }),
    timeframe_end: timestamp("timeframe_end", { withTimezone: true }),
    role_context: text("role_context"),
    domain_hint: text("domain_hint"),
    commitment_level: commitmentLevelEnum("commitment_level"),
    mode: userModeEnum("mode").notNull().default("individual"),
    current_domain: domainEnum("current_domain"),
    status: blueprintStatusEnum("status").notNull().default("draft"),
    active: boolean("active").notNull().default(false),
    current_condition: conditionEnum("current_condition"),
    current_plan_id: uuid("current_plan_id"),
    current_phase_id: uuid("current_phase_id"),
    validation_id: uuid("validation_id").references(() => validations.id),
    state_version: integer("state_version").notNull().default(0),
    paused_at: timestamp("paused_at", { withTimezone: true }),
    pause_reason: text("pause_reason"),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    abandoned_at: timestamp("abandoned_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_blueprints_user_id").on(t.user_id),
    index("idx_blueprints_status").on(t.status),
  ],
);

export const blueprintPolicies = pgTable(
  "blueprint_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    focus_statement: text("focus_statement"),
    anti_focus: text("anti_focus"),
    rules: jsonb("rules").notNull().default(sql`'[]'::jsonb`),
    enforcement_level: text("enforcement_level").notNull().default("guidance"),
    generated_from: jsonb("generated_from").notNull().default(sql`'{}'::jsonb`),
    ai_log_id: uuid("ai_log_id").references(() => bhudhiLogs.id),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_blueprint_policies_blueprint_id").on(t.blueprint_id),
    index("idx_blueprint_policies_blueprint_active").on(t.blueprint_id, t.active),
  ],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    order_index: integer("order_index").notNull(),
    status: planStatusEnum("status").notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_plans_blueprint_id").on(t.blueprint_id)],
);

export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    plan_id: uuid("plan_id").references(() => plans.id),
    name: seasonNameEnum("name").notNull().default("ignition"),
    order_index: integer("order_index").notNull(),
    effort_level: text("effort_level"),
    start_date: timestamp("start_date", { withTimezone: true }),
    end_date: timestamp("end_date", { withTimezone: true }),
    status: planStatusEnum("status").notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_seasons_blueprint_id").on(t.blueprint_id)],
);

export const targets = pgTable(
  "targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    plan_id: uuid("plan_id").references(() => plans.id),
    season_id: uuid("season_id").references(() => seasons.id),
    owner_id: uuid("owner_id").references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    type: targetTypeEnum("type").notNull(),
    metric: text("metric"),
    target_value: doublePrecision("target_value"),
    current_value: doublePrecision("current_value").notNull().default(0),
    unit: text("unit"),
    progress: doublePrecision("progress").notNull().default(0),
    order_index: integer("order_index").notNull().default(0),
    status: targetStatusEnum("status").notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_targets_blueprint_id").on(t.blueprint_id),
    index("idx_targets_status").on(t.status),
  ],
);

export const phases = pgTable(
  "phases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    target_id: uuid("target_id").references(() => targets.id),
    plan_id: uuid("plan_id").references(() => plans.id),
    name: phaseNameEnum("name").notNull(),
    order_index: integer("order_index").notNull(),
    gate_criteria: jsonb("gate_criteria"),
    status: phaseStatusEnum("status").notNull().default("pending"),
    locked: boolean("locked").notNull().default(false),
    gate_passed: boolean("gate_passed").notNull().default(false),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_phases_blueprint_id").on(t.blueprint_id),
    index("idx_phases_status").on(t.status),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    phase_id: uuid("phase_id").references(() => phases.id),
    target_id: uuid("target_id").references(() => targets.id),
    owner_id: uuid("owner_id").references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    type: projectTypeEnum("type").notNull(),
    is_blocked: boolean("is_blocked").notNull().default(false),
    blocked_reason: text("blocked_reason"),
    order_index: integer("order_index").notNull().default(0),
    status: projectStatusEnum("status").notNull().default("pending"),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_projects_blueprint_id").on(t.blueprint_id),
    index("idx_projects_status").on(t.status),
  ],
);

export const actions = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    project_id: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    target_id: uuid("target_id").references(() => targets.id),
    name: text("name").notNull(),
    description: text("description"),
    type: actionTypeEnum("type").notNull(),
    knowledge_category: text("knowledge_category"),
    order_index: integer("order_index").notNull().default(0),
    status: text("status").notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_actions_blueprint_id").on(t.blueprint_id),
    index("idx_actions_project_id").on(t.project_id),
  ],
);

export const enforcementPackages = pgTable(
  "enforcement_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    condition_id: uuid("condition_id"),
    signal_snapshot_id: uuid("signal_snapshot_id"),
    condition: conditionEnum("condition").notNull(),
    task_limits: jsonb("task_limits").notNull().default(sql`'{}'::jsonb`),
    difficulty_cap: difficultyEnum("difficulty_cap").notNull().default("moderate"),
    allowed_actions: text("allowed_actions").array().notNull().default(sql`ARRAY[]::text[]`),
    blocked_actions: text("blocked_actions").array().notNull().default(sql`ARRAY[]::text[]`),
    phase_permission: phasePermissionEnum("phase_permission"),
    target_adjustment: targetAdjustmentEnum("target_adjustment"),
    ai_mode: aiModeEnum("ai_mode"),
    ui_mode: uiModeEnum("ui_mode"),
    feature_permissions: jsonb("feature_permissions").notNull().default(sql`'{}'::jsonb`),
    risk_level: riskLevelEnum("risk_level"),
    override_flags: jsonb("override_flags").notNull().default(sql`'{}'::jsonb`),
    cognitive_load_score: doublePrecision("cognitive_load_score"),
    is_current: boolean("is_current").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_enforcement_packages_blueprint_id").on(t.blueprint_id),
    index("idx_enforcement_packages_blueprint_current").on(t.blueprint_id, t.is_current),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action_id: uuid("action_id").references(() => actions.id),
    linked_plan_id: uuid("linked_plan_id").references(() => plans.id),
    linked_season_id: uuid("linked_season_id").references(() => seasons.id),
    linked_target_id: uuid("linked_target_id").references(() => targets.id),
    linked_phase_id: uuid("linked_phase_id").references(() => phases.id),
    linked_project_id: uuid("linked_project_id").references(() => projects.id),
    enforcement_package_id: uuid("enforcement_package_id").references(() => enforcementPackages.id),
    task_type: taskTypeEnum("task_type").notNull(),
    title: text("title").notNull(),
    instruction: text("instruction").notNull(),
    expected_output: text("expected_output").notNull(),
    definition_of_done: text("definition_of_done").notNull(),
    why_it_matters: text("why_it_matters"),
    time_estimate_minutes: integer("time_estimate_minutes"),
    content_hash: text("content_hash"),
    proof_required: boolean("proof_required").notNull().default(false),
    proof_type: proofTypeEnum("proof_type"),
    proof_description: text("proof_description"),
    difficulty: difficultyEnum("difficulty").notNull().default("moderate"),
    priority: integer("priority").notNull().default(5),
    domain: domainEnum("domain"),
    value_score: doublePrecision("value_score"),
    condition_at_generation: text("condition_at_generation"),
    domain_at_generation: text("domain_at_generation"),
    generation_reason: text("generation_reason"),
    status: orderStatusEnum("status").notNull().default("pending"),
    blocker_type: text("blocker_type"),
    blocker_description: text("blocker_description"),
    dependency_reference: text("dependency_reference"),
    output_summary: text("output_summary"),
    proof_json: jsonb("proof_json"),
    started_at: timestamp("started_at", { withTimezone: true }),
    finished_at: timestamp("finished_at", { withTimezone: true }),
    due_at: timestamp("due_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_orders_blueprint_id").on(t.blueprint_id),
    index("idx_orders_status").on(t.status),
    index("idx_orders_blueprint_status").on(t.blueprint_id, t.status),
  ],
);

// ── GROUP 3 — DEPENDENCIES ──────────────────────────────────────────────────

export const projectDependencies = pgTable(
  "project_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").notNull(),
    blocking_project_id: uuid("blocking_project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    blocked_project_id: uuid("blocked_project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uniq_project_dependency").on(t.blocking_project_id, t.blocked_project_id),
  ],
);

export const orderDependencies = pgTable(
  "order_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").notNull(),
    blocking_order_id: uuid("blocking_order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    blocked_order_id: uuid("blocked_order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uniq_order_dependency").on(t.blocking_order_id, t.blocked_order_id),
  ],
);

// ── GROUP 4 — FEEDBACK & TRUTH ──────────────────────────────────────────────

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    order_id: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    completion_status: text("completion_status").notNull(),
    score: integer("score"),
    weighted_score: doublePrecision("weighted_score"),
    reflection: text("reflection"),
    friction_score: doublePrecision("friction_score"),
    confidence_score: doublePrecision("confidence_score"),
    duration_minutes: integer("duration_minutes"),
    proof_json: jsonb("proof_json"),
    blocker_json: jsonb("blocker_json"),
    interrogation_json: jsonb("interrogation_json"),
    gaming_flag: boolean("gaming_flag").notNull().default(false),
    gaming_reason: text("gaming_reason"),
    validity: text("validity").notNull().default("valid"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_feedback_order_id").on(t.order_id),
    index("idx_feedback_blueprint_id").on(t.blueprint_id),
    index("idx_feedback_user_id").on(t.user_id),
  ],
);

// ── GROUP 5 — SIGNAL & CONTROL ──────────────────────────────────────────────

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    event_type: text("event_type").notNull(),
    entity_type: text("entity_type").notNull(),
    entity_id: uuid("entity_id"),
    user_id: uuid("user_id"),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    idempotency_key: text("idempotency_key").unique(),
    status: eventStatusEnum("status").notNull().default("pending"),
    retry_count: integer("retry_count").notNull().default(0),
    max_retries: integer("max_retries").notNull().default(3),
    process_after: timestamp("process_after", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_events_status").on(t.status),
    index("idx_events_event_type").on(t.event_type),
    index("idx_events_blueprint_id").on(t.blueprint_id),
  ],
);

export const signalSnapshots = pgTable(
  "signal_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    window_start: timestamp("window_start", { withTimezone: true }).notNull(),
    window_end: timestamp("window_end", { withTimezone: true }).notNull(),
    completion_rate: doublePrecision("completion_rate").notNull(),
    weighted_score: doublePrecision("weighted_score").notNull(),
    momentum: integer("momentum").notNull(),
    trend: signalTrendEnum("trend").notNull().default("stable"),
    confidence: signalConfidenceEnum("confidence").notNull().default("insufficient_data"),
    blocker_ratio: doublePrecision("blocker_ratio").notNull().default(0),
    skip_ratio: doublePrecision("skip_ratio").notNull().default(0),
    assigned_condition: conditionEnum("assigned_condition"),
    is_current: boolean("is_current").notNull().default(true),
    causation_event_id: uuid("causation_event_id").references(() => events.id),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_signal_snapshots_blueprint_id").on(t.blueprint_id),
    index("idx_signal_snapshots_blueprint_current").on(t.blueprint_id, t.is_current),
  ],
);

export const conditions = pgTable(
  "conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    condition: conditionEnum("condition").notNull(),
    signal_snapshot_id: uuid("signal_snapshot_id").references(() => signalSnapshots.id),
    duration_days: integer("duration_days").notNull().default(0),
    escalation_level: integer("escalation_level").notNull().default(0),
    recovery_required: boolean("recovery_required").notNull().default(false),
    transition_reason: text("transition_reason"),
    previous_condition: conditionEnum("previous_condition"),
    is_current: boolean("is_current").notNull().default(true),
    entered_at: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    exited_at: timestamp("exited_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_conditions_blueprint_id").on(t.blueprint_id),
    index("idx_conditions_blueprint_current").on(t.blueprint_id, t.is_current),
  ],
);

// ── GROUP 6 — EVENT SYSTEM ──────────────────────────────────────────────────

export const eventLogs = pgTable(
  "event_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    event_id: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    worker: text("worker"),
    result: eventLogResultEnum("result"),
    error_code: text("error_code"),
    error_message: text("error_message"),
    duration_ms: integer("duration_ms"),
    processed_at: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_event_logs_event_id").on(t.event_id)],
);

export const deadLetterEvents = pgTable(
  "dead_letter_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    original_event_id: uuid("original_event_id").notNull(),
    event_type: text("event_type").notNull(),
    blueprint_id: uuid("blueprint_id"),
    user_id: uuid("user_id"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    failure_reason: text("failure_reason").notNull(),
    retry_count: integer("retry_count").notNull(),
    last_error: text("last_error"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewed: boolean("reviewed").notNull().default(false),
    reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
    resolved: boolean("resolved").notNull().default(false),
  },
  (t) => [
    index("idx_dead_letter_event_type").on(t.event_type),
    index("idx_dead_letter_resolved").on(t.resolved),
  ],
);

// ── GROUP 7 — DOMAIN & FRAMEWORK ────────────────────────────────────────────

export const domainHistory = pgTable(
  "domain_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: domainEnum("domain").notNull(),
    previous_domain: domainEnum("previous_domain"),
    transition_trigger: domainTransitionTriggerEnum("transition_trigger").notNull(),
    trigger_event_id: uuid("trigger_event_id").references(() => events.id),
    transition_notes: text("transition_notes"),
    is_current: boolean("is_current").notNull().default(true),
    entered_at: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    exited_at: timestamp("exited_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_domain_history_blueprint_id").on(t.blueprint_id),
    index("idx_domain_history_blueprint_current").on(t.blueprint_id, t.is_current),
  ],
);

export const frameworkActivations = pgTable(
  "framework_activations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    signal_snapshot_id: uuid("signal_snapshot_id").references(() => signalSnapshots.id),
    framework_name: frameworkNameEnum("framework_name").notNull(),
    activation_level: frameworkActivationLevelEnum("activation_level"),
    confidence: doublePrecision("confidence"),
    reason: text("reason"),
    trigger_condition: text("trigger_condition"),
    status: text("status").notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("idx_framework_activations_blueprint_id").on(t.blueprint_id)],
);

export const frameworkDecisions = pgTable(
  "framework_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activation_id: uuid("activation_id")
      .notNull()
      .references(() => frameworkActivations.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    decision_type: text("decision_type").notNull(),
    target_layer: text("target_layer"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    requires_control_engine: boolean("requires_control_engine").notNull().default(true),
    status: frameworkDecisionStatusEnum("status").notNull().default("proposed"),
    rejection_reason: text("rejection_reason"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_framework_decisions_blueprint_id").on(t.blueprint_id),
    index("idx_framework_decisions_status").on(t.status),
  ],
);

export const frameworkSignalSnapshots = pgTable(
  "framework_signal_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    signal_snapshot_id: uuid("signal_snapshot_id").references(() => signalSnapshots.id),
    framework_name: frameworkNameEnum("framework_name").notNull(),
    signal_state: text("signal_state").notNull(),
    score: doublePrecision("score"),
    confidence: doublePrecision("confidence"),
    evidence_json: jsonb("evidence_json").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_framework_signal_snapshots_blueprint_id").on(t.blueprint_id)],
);

// ── GROUP 8 — CAPABILITY & BEHAVIOR ─────────────────────────────────────────

export const capabilityProfiles = pgTable("capability_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
  level: capabilityLevelEnum("level").notNull().default("beginner"),
  consistency_score: doublePrecision("consistency_score").notNull().default(0),
  execution_quality: doublePrecision("execution_quality").notNull().default(0),
  throughput: throughputEnum("throughput").notNull().default("low"),
  recovery_rate: doublePrecision("recovery_rate").notNull().default(0),
  fatigue_risk: fatigueRiskEnum("fatigue_risk").notNull().default("low"),
  current_difficulty: difficultyEnum("current_difficulty").notNull().default("easy"),
  tasks_completed: integer("tasks_completed").notNull().default(0),
  tasks_failed: integer("tasks_failed").notNull().default(0),
  streak_current: integer("streak_current").notNull().default(0),
  streak_best: integer("streak_best").notNull().default(0),
  identity_type: text("identity_type"),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const capabilityHistory = pgTable(
  "capability_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id"),
    trigger_event: text("trigger_event"),
    snapshot: jsonb("snapshot").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_capability_history_user_id").on(t.user_id)],
);

export const behaviorPatterns = pgTable(
  "behavior_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    pattern_type: behaviorPatternTypeEnum("pattern_type").notNull(),
    severity: text("severity"),
    confidence: doublePrecision("confidence"),
    frequency: integer("frequency").notNull().default(1),
    evidence_json: jsonb("evidence_json").notNull().default(sql`'{}'::jsonb`),
    status: behaviorPatternStatusEnum("status").notNull().default("active"),
    first_detected_at: timestamp("first_detected_at", { withTimezone: true }).notNull().defaultNow(),
    last_detected_at: timestamp("last_detected_at", { withTimezone: true }).notNull().defaultNow(),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_behavior_patterns_user_id").on(t.user_id),
    index("idx_behavior_patterns_status").on(t.status),
  ],
);

export const behaviorEvents = pgTable(
  "behavior_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id"),
    pattern_id: uuid("pattern_id").references(() => behaviorPatterns.id),
    order_id: uuid("order_id"),
    feedback_id: uuid("feedback_id").references(() => feedback.id),
    event_type: text("event_type").notNull(),
    data_json: jsonb("data_json").notNull().default(sql`'{}'::jsonb`),
    detected_at: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_behavior_events_user_id").on(t.user_id),
    index("idx_behavior_events_pattern_id").on(t.pattern_id),
  ],
);

export const inactivityRecords = pgTable(
  "inactivity_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    last_activity_at: timestamp("last_activity_at", { withTimezone: true }).notNull(),
    inactivity_hours: doublePrecision("inactivity_hours").notNull(),
    inactivity_days: doublePrecision("inactivity_days").notNull(),
    threshold_breached: inactivityThresholdEnum("threshold_breached").notNull(),
    response_triggered: text("response_triggered"),
    response_event_id: uuid("response_event_id").references(() => events.id),
    recovery_task_id: uuid("recovery_task_id").references(() => orders.id),
    resolved: boolean("resolved").notNull().default(false),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_inactivity_records_user_id").on(t.user_id),
    index("idx_inactivity_records_blueprint_resolved").on(t.blueprint_id, t.resolved),
  ],
);

// ── GROUP 9 — IDENTITY & ENGAGEMENT ─────────────────────────────────────────

export const userIdentityStates = pgTable(
  "user_identity_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    current_identity: text("current_identity"),
    target_identity: text("target_identity"),
    identity_gap_score: doublePrecision("identity_gap_score").notNull().default(0),
    stage: identityStageEnum("stage").notNull().default("starting"),
    reinforcement_count: integer("reinforcement_count").notNull().default(0),
    last_reinforced_at: timestamp("last_reinforced_at", { withTimezone: true }),
    transformation_score: doublePrecision("transformation_score").notNull().default(0),
    is_current: boolean("is_current").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_user_identity_states_user_id").on(t.user_id),
    index("idx_user_identity_states_blueprint_current").on(t.blueprint_id, t.is_current),
  ],
);

export const identityHistory = pgTable(
  "identity_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id"),
    trigger: text("trigger"),
    stage_before: text("stage_before"),
    stage_after: text("stage_after"),
    transformation_score: doublePrecision("transformation_score"),
    snapshot: jsonb("snapshot").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_identity_history_user_id").on(t.user_id)],
);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    type: milestoneTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    value: doublePrecision("value"),
    metadata_json: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    seen_by_user: boolean("seen_by_user").notNull().default(false),
    seen_at: timestamp("seen_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_milestones_user_id").on(t.user_id),
    index("idx_milestones_blueprint_id").on(t.blueprint_id),
  ],
);

export const rewardEvents = pgTable(
  "reward_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id"),
    milestone_id: uuid("milestone_id"),
    reward_type: text("reward_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    ui_action: text("ui_action"),
    delivered: boolean("delivered").notNull().default(false),
    delivered_at: timestamp("delivered_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_reward_events_user_id").on(t.user_id),
    index("idx_reward_events_delivered").on(t.delivered),
  ],
);

// ── GROUP 10 — EXECUTION SUPPORT ────────────────────────────────────────────

export const habits = pgTable(
  "habits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    frequency: text("frequency"),
    time_of_day: text("time_of_day"),
    active: boolean("active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_habits_blueprint_id").on(t.blueprint_id)],
);

export const habitCheckins = pgTable(
  "habit_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    habit_id: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    order_id: uuid("order_id"),
    completed: boolean("completed").notNull(),
    effort_score: integer("effort_score"),
    note: text("note"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_habit_checkins_habit_id").on(t.habit_id)],
);

export const knowledgeObjects = pgTable(
  "knowledge_objects",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    user_id: uuid("user_id").references(() => users.id),
    title: text("title").notNull(),
    content: text("content").notNull(),
    content_json: jsonb("content_json").notNull().default(sql`'{}'::jsonb`),
    type: text("type").notNull(),
    domain: domainEnum("domain"),
    action_type: text("action_type"),
    applicable_level: text("applicable_level"),
    is_global: boolean("is_global").notNull().default(false),
    active: boolean("active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_knowledge_objects_domain").on(t.domain),
    index("idx_knowledge_objects_type").on(t.type),
  ],
);

export const orderKnowledgeLinks = pgTable(
  "order_knowledge_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    order_id: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    knowledge_id: text("knowledge_id")
      .notNull()
      .references(() => knowledgeObjects.id, { onDelete: "cascade" }),
    injection_type: text("injection_type"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_order_knowledge").on(t.order_id, t.knowledge_id)],
);

export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    week_start: timestamp("week_start", { withTimezone: true }).notNull(),
    week_end: timestamp("week_end", { withTimezone: true }).notNull(),
    wins: text("wins"),
    failures: text("failures"),
    patterns: text("patterns"),
    next_focus: text("next_focus"),
    reflection: text("reflection"),
    patterns_detected: jsonb("patterns_detected").notNull().default(sql`'[]'::jsonb`),
    issues_identified: jsonb("issues_identified").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_weekly_reviews_blueprint_id").on(t.blueprint_id)],
);

export const phaseCheckpoints = pgTable(
  "phase_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    phase_id: uuid("phase_id")
      .notNull()
      .references(() => phases.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    outcomes_achieved: text("outcomes_achieved"),
    evidence_summary: text("evidence_summary"),
    bottlenecks: text("bottlenecks"),
    next_risks: text("next_risks"),
    proof_json: jsonb("proof_json").notNull().default(sql`'{}'::jsonb`),
    readiness: text("readiness"),
    system_verdict: text("system_verdict"),
    rejection_reason: text("rejection_reason"),
    evaluated_at: timestamp("evaluated_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_phase_checkpoints_blueprint_id").on(t.blueprint_id)],
);

export const academyTasks = pgTable(
  "academy_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    order_id: uuid("order_id").references(() => orders.id),
    knowledge_id: text("knowledge_id").references(() => knowledgeObjects.id),
    title: text("title").notNull(),
    description: text("description"),
    learning_content: text("learning_content"),
    trigger_reason: text("trigger_reason").notNull(),
    domain: text("domain"),
    skill_target: text("skill_target"),
    proof_required: boolean("proof_required").notNull().default(true),
    proof_description: text("proof_description"),
    status: text("status").notNull().default("pending"),
    blocks_execution: boolean("blocks_execution").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_academy_tasks_blueprint_id").on(t.blueprint_id),
    index("idx_academy_tasks_status").on(t.status),
  ],
);

export const academyProof = pgTable(
  "academy_proof",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    academy_task_id: uuid("academy_task_id")
      .notNull()
      .references(() => academyTasks.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    proof_json: jsonb("proof_json").notNull().default(sql`'{}'::jsonb`),
    reflection: text("reflection"),
    validation_status: text("validation_status").notNull().default("pending"),
    rejection_reason: text("rejection_reason"),
    validated_at: timestamp("validated_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_academy_proof_task_id").on(t.academy_task_id)],
);

export const realOutcomes = pgTable(
  "real_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    target_id: uuid("target_id").references(() => targets.id),
    metric_name: text("metric_name").notNull(),
    metric_value: doublePrecision("metric_value").notNull(),
    unit: text("unit"),
    source: text("source"),
    recorded_at: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_real_outcomes_blueprint_id").on(t.blueprint_id)],
);

export const outcomeValidations = pgTable(
  "outcome_validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").notNull(),
    user_id: uuid("user_id").notNull(),
    tasks_completed: integer("tasks_completed").notNull().default(0),
    outcomes_verified: integer("outcomes_verified").notNull().default(0),
    alignment_score: doublePrecision("alignment_score").notNull().default(0),
    verdict: text("verdict"),
    notes: text("notes"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_outcome_validations_blueprint_id").on(t.blueprint_id)],
);

export const falseProgressFlags = pgTable(
  "false_progress_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").notNull(),
    user_id: uuid("user_id").notNull(),
    detection_type: text("detection_type").notNull(),
    evidence_json: jsonb("evidence_json").notNull().default(sql`'{}'::jsonb`),
    severity: text("severity"),
    resolved: boolean("resolved").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_false_progress_flags_blueprint_id").on(t.blueprint_id),
    index("idx_false_progress_flags_resolved").on(t.resolved),
  ],
);

export const stateMemory = pgTable(
  "state_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    condition: text("condition").notNull(),
    entered_at: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    exited_at: timestamp("exited_at", { withTimezone: true }),
    duration_days: integer("duration_days").notNull().default(0),
    escalation_level: integer("escalation_level").notNull().default(0),
    is_current: boolean("is_current").notNull().default(true),
  },
  (t) => [
    index("idx_state_memory_blueprint_id").on(t.blueprint_id),
    index("idx_state_memory_blueprint_current").on(t.blueprint_id, t.is_current),
  ],
);

export const escalationLogs = pgTable(
  "escalation_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    level: integer("level").notNull().default(1),
    condition: text("condition").notNull(),
    trigger_reason: text("trigger_reason").notNull(),
    action_taken: text("action_taken"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_escalation_logs_blueprint_id").on(t.blueprint_id)],
);

export const blueprintVersions = pgTable(
  "blueprint_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    version_number: integer("version_number").notNull(),
    change_type: text("change_type").notNull(),
    affected_layer: text("affected_layer").notNull(),
    before_state: jsonb("before_state").notNull(),
    after_state: jsonb("after_state").notNull(),
    framework_source: text("framework_source"),
    triggered_by: text("triggered_by"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_blueprint_versions_blueprint_id").on(t.blueprint_id)],
);

export const blueprintMutations = pgTable(
  "blueprint_mutations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    mutation_type: text("mutation_type").notNull(),
    layer: text("layer").notNull(),
    entity_id: uuid("entity_id"),
    change_summary: text("change_summary").notNull(),
    cascade_json: jsonb("cascade_json").notNull().default(sql`'[]'::jsonb`),
    approved: boolean("approved").notNull().default(false),
    approved_at: timestamp("approved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_blueprint_mutations_blueprint_id").on(t.blueprint_id)],
);

export const taskGenerationLog = pgTable(
  "task_generation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    generation_trigger: generationTriggerEnum("generation_trigger").notNull(),
    generation_mode: generationModeEnum("generation_mode").notNull(),
    condition_at_generation: text("condition_at_generation").notNull(),
    enforcement_package_id: uuid("enforcement_package_id").references(
      () => enforcementPackages.id,
    ),
    capability_level: text("capability_level"),
    domain_at_generation: text("domain_at_generation"),
    input_json: jsonb("input_json").notNull().default(sql`'{}'::jsonb`),
    orders_generated: integer("orders_generated").notNull().default(0),
    order_ids: text("order_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    generation_notes: text("generation_notes"),
    used_fallback: boolean("used_fallback").notNull().default(false),
    fallback_reason: text("fallback_reason"),
    ai_log_id: uuid("ai_log_id").references(() => bhudhiLogs.id),
    ai_used: boolean("ai_used").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_task_generation_log_blueprint_id").on(t.blueprint_id),
    index("idx_task_generation_log_trigger").on(t.generation_trigger),
  ],
);

export const decisionTraces = pgTable(
  "decision_traces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    decision_type: text("decision_type").notNull(),
    entity_type: text("entity_type"),
    entity_id: uuid("entity_id"),
    reasoning: text("reasoning").notNull(),
    inputs_json: jsonb("inputs_json").notNull().default(sql`'{}'::jsonb`),
    outputs_json: jsonb("outputs_json").notNull().default(sql`'{}'::jsonb`),
    engine: text("engine"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_decision_traces_blueprint_id").on(t.blueprint_id),
    index("idx_decision_traces_decision_type").on(t.decision_type),
  ],
);

export const cognitiveLoadScores = pgTable(
  "cognitive_load_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    load_score: doublePrecision("load_score").notNull(),
    active_tasks: integer("active_tasks").notNull(),
    complexity_level: text("complexity_level"),
    recommendation: text("recommendation"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cognitive_load_scores_user_id").on(t.user_id),
    index("idx_cognitive_load_scores_blueprint_id").on(t.blueprint_id),
  ],
);

export const bhudhiMemory = pgTable(
  "bhudhi_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    memory_type: text("memory_type").notNull(),
    content_json: jsonb("content_json").notNull(),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    reinforcement_count: integer("reinforcement_count").notNull().default(1),
    last_reinforced_at: timestamp("last_reinforced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_bhudhi_memory_user_id").on(t.user_id),
    index("idx_bhudhi_memory_user_type").on(t.user_id, t.memory_type),
  ],
);

export const systemHealthLogs = pgTable(
  "system_health_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    check_type: text("check_type").notNull(),
    status: text("status").notNull(),
    score: doublePrecision("score"),
    details_json: jsonb("details_json").notNull().default(sql`'{}'::jsonb`),
    issues_detected: text("issues_detected").array().notNull().default(sql`ARRAY[]::text[]`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_system_health_logs_blueprint_id").on(t.blueprint_id),
    index("idx_system_health_logs_check_type").on(t.check_type),
  ],
);

export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  feature_name: text("feature_name").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  environment: text("environment"),
  description: text("description"),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

// ── GROUP 11 — NOTIFICATIONS & PIVOT ────────────────────────────────────────

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    notification_type: text("notification_type").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("pending"),
    suppression_reason: text("suppression_reason"),
    source_event_id: text("source_event_id"),
    idempotency_key: text("idempotency_key").notNull().unique(),
    attempt_count: integer("attempt_count").notNull().default(0),
    last_error: text("last_error"),
    /** Serialized delivery params for quiet-hours deferral replay (Prompt 13). */
    payload_snapshot: jsonb("payload_snapshot").notNull().default(sql`'{}'::jsonb`),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_notification_logs_user_id").on(t.user_id),
    index("idx_notification_logs_status").on(t.status),
    index("idx_notification_logs_type").on(t.notification_type),
  ],
);

export const pivotReviews = pgTable(
  "pivot_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trigger_type: text("trigger_type").notNull(),
    trigger_reason: text("trigger_reason").notNull(),
    signal_snapshot_id: uuid("signal_snapshot_id").references(() => signalSnapshots.id),
    condition_at_trigger: text("condition_at_trigger"),
    path_options_json: jsonb("path_options_json").notNull().default(sql`'[]'::jsonb`),
    status: text("status").notNull().default("open"),
    selected_path: text("selected_path"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_pivot_reviews_blueprint_id").on(t.blueprint_id),
    index("idx_pivot_reviews_status").on(t.status),
  ],
);
