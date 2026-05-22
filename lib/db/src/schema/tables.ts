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
  intelligenceDepthEnum,
  teamRoleEnum,
  blueprintOperationalStateEnum,
  validationVerdictEnum,
  selectedPathEnum,
  validationReadinessEnum,
  validationKindEnum,
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
  active_blueprint_id: uuid("active_blueprint_id"),
  civilization_context: jsonb("civilization_context"),
  communication_profile: jsonb("communication_profile"),
  metadata: jsonb("metadata"),
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
    token: text("token").unique(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    last_used_at: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_sessions_user_id").on(t.user_id), index("idx_sessions_expires_at").on(t.expires_at)],
);

export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    used: boolean("used").notNull().default(false),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_magic_link_tokens_user_id").on(t.user_id),
    index("idx_magic_link_tokens_email").on(t.email),
  ],
);

// ── GROUP 2 — BLUEPRINT CHAIN ───────────────────────────────────────────────

export const validations = pgTable(
  "validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contract_id: uuid("contract_id").notNull().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    raw_goal: text("raw_goal"),
    purpose: text("purpose"),
    timeframe: text("timeframe"),
    timeframe_days: integer("timeframe_days"),
    domain: text("domain"),
    current_context: text("current_context"),
    success_signal: text("success_signal"),
    location_context: text("location_context"),
    reality_context: text("reality_context"),
    selected_blueprint_tier: userTierEnum("selected_blueprint_tier").default("starter"),
    selected_blueprint_mode: userModeEnum("selected_blueprint_mode").default("individual"),
    verdict: validationVerdictEnum("verdict"),
    overall_score: integer("overall_score"),
    scores: jsonb("scores"),
    key_insights: jsonb("key_insights"),
    potential_risks: jsonb("potential_risks"),
    path_options: jsonb("path_options"),
    recommendation: text("recommendation"),
    intelligence: jsonb("intelligence"),
    ai_summary: text("ai_summary"),
    feasibility_score: doublePrecision("feasibility_score"),
    clarity_score: doublePrecision("clarity_score"),
    realism_score: doublePrecision("realism_score"),
    path_current: jsonb("path_current"),
    path_adjusted: jsonb("path_adjusted"),
    path_alternative: jsonb("path_alternative"),
    selected_path: selectedPathEnum("selected_path"),
    selected_at: timestamp("selected_at", { withTimezone: true }),
    idempotency_key: text("idempotency_key"),
    status: text("status").notNull().default("pending"),
    validation_kind: validationKindEnum("validation_kind").notNull().default("unknown"),
    payload_version: integer("payload_version").notNull().default(1),
    selected_path_type: text("selected_path_type"),
    tier: userTierEnum("tier"),
    intelligence_payload: jsonb("intelligence_payload"),
    blueprint_contract: jsonb("blueprint_contract"),
    launch_blocked: boolean("launch_blocked").notNull().default(false),
    readiness: validationReadinessEnum("readiness"),
    adjusted_path_confirmed: boolean("adjusted_path_confirmed").notNull().default(false),
    location_country: text("location_country"),
    location_city: text("location_city"),
    business_type: text("business_type"),
    business_model: text("business_model"),
    budget_available: doublePrecision("budget_available"),
    currency: text("currency"),
    current_resources: jsonb("current_resources"),
    target_customer: text("target_customer"),
    desired_outcome: text("desired_outcome"),
    known_blockers: jsonb("known_blockers"),
    commitment_level: text("commitment_level"),
    market_score: doublePrecision("market_score"),
    execution_score: doublePrecision("execution_score"),
    timing_score: doublePrecision("timing_score"),
    competition_score: doublePrecision("competition_score"),
    scalability_score: doublePrecision("scalability_score"),
    local_economy_score: doublePrecision("local_economy_score"),
    resource_score: doublePrecision("resource_score"),
    blueprint_difficulty_score: doublePrecision("blueprint_difficulty_score"),
    risk_score: doublePrecision("risk_score"),
    momentum_potential: doublePrecision("momentum_potential"),
    trust_building_score: doublePrecision("trust_building_score"),
    reality_score: doublePrecision("reality_score"),
    archetype_resolution: jsonb("archetype_resolution"),
    purpose_decomposition: jsonb("purpose_decomposition"),
    industry_intelligence: jsonb("industry_intelligence"),
    market_analysis: jsonb("market_analysis"),
    competitor_analysis: jsonb("competitor_analysis"),
    economy_briefing: jsonb("economy_briefing"),
    customer_pain_analysis: jsonb("customer_pain_analysis"),
    timing_analysis: jsonb("timing_analysis"),
    execution_difficulty: jsonb("execution_difficulty"),
    time_simulations: jsonb("time_simulations"),
    industry_pros: jsonb("industry_pros"),
    industry_cons: jsonb("industry_cons"),
    winner_analysis: jsonb("winner_analysis"),
    first_week_plan: jsonb("first_week_plan"),
    recommended_blueprint_level: text("recommended_blueprint_level"),
    erector_payload: jsonb("erector_payload"),
    erector_validation_stage: text("erector_validation_stage").default("pending"),
    validation_stage: text("validation_stage").notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_validations_blueprint_id").on(t.blueprint_id),
    uniqueIndex("idx_validations_contract_id").on(t.contract_id),
    uniqueIndex("idx_validations_idempotency_key").on(t.idempotency_key),
  ],
);

export const economicArchetypes = pgTable(
  "economic_archetypes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    archetype_number: integer("archetype_number").notNull().unique(),
    name: text("name").notNull(),
    countries: text("countries").array().notNull().default(sql`ARRAY[]::text[]`),
    institutional_strength: doublePrecision("institutional_strength").notNull(),
    corruption_index: doublePrecision("corruption_index").notNull(),
    infrastructure_quality: doublePrecision("infrastructure_quality").notNull(),
    digital_adoption: doublePrecision("digital_adoption").notNull(),
    consumer_purchasing_power: doublePrecision("consumer_purchasing_power").notNull(),
    startup_ecosystem_maturity: doublePrecision("startup_ecosystem_maturity").notNull(),
    regulatory_openness: doublePrecision("regulatory_openness").notNull(),
    political_stability: doublePrecision("political_stability").notNull(),
    labor_market_flexibility: doublePrecision("labor_market_flexibility").notNull(),
    market_competition_density: doublePrecision("market_competition_density").notNull(),
    consumer_behavior_patterns: jsonb("consumer_behavior_patterns").notNull().default(sql`'[]'::jsonb`),
    typical_resistance_patterns: jsonb("typical_resistance_patterns").notNull().default(sql`'[]'::jsonb`),
    survivor_behavior_patterns: jsonb("survivor_behavior_patterns").notNull().default(sql`'[]'::jsonb`),
    cultural_business_norms: jsonb("cultural_business_norms").notNull().default(sql`'[]'::jsonb`),
    primary_risk_factors: jsonb("primary_risk_factors").notNull().default(sql`'[]'::jsonb`),
    primary_opportunity_factors: jsonb("primary_opportunity_factors").notNull().default(sql`'[]'::jsonb`),
    timeframe_pressure_multiplier: doublePrecision("timeframe_pressure_multiplier").notNull().default(1),
    execution_intensity_multiplier: doublePrecision("execution_intensity_multiplier").notNull().default(1),
    blueprint_difficulty_adjustment: doublePrecision("blueprint_difficulty_adjustment").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("idx_economic_archetypes_number").on(t.archetype_number)],
);

export const validationArchetypeMaps = pgTable(
  "validation_archetype_maps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_id: uuid("validation_id")
      .notNull()
      .references(() => validations.id, { onDelete: "cascade" }),
    archetype_id: uuid("archetype_id")
      .notNull()
      .references(() => economicArchetypes.id),
    is_primary: boolean("is_primary").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_validation_archetype_maps_validation_id").on(t.validation_id)],
);

export const bhudhiLogs = pgTable(
  "bhudhi_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
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
    confidence_tier: text("confidence_tier"),
    fallback_used: boolean("fallback_used").notNull().default(false),
    output_hash: text("output_hash"),
    world_state_version: integer("world_state_version"),
    validation_fail_reason: text("validation_fail_reason"),
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
    raw_goal: text("raw_goal"),
    purpose: text("purpose"),
    current_context: text("current_context"),
    success_signal: text("success_signal"),
    known_blockers: text("known_blockers"),
    timeframe_days: integer("timeframe_days"),
    timeframe_start: timestamp("timeframe_start", { withTimezone: true }),
    timeframe_end: timestamp("timeframe_end", { withTimezone: true }),
    role_context: text("role_context"),
    domain_hint: text("domain_hint"),
    domain: text("domain"),
    location: jsonb("location"),
    business_model: text("business_model"),
    online_offline: text("online_offline"),
    budget: doublePrecision("budget"),
    current_resources: jsonb("current_resources"),
    target_customers: text("target_customers"),
    target_profit: doublePrecision("target_profit"),
    selected_path: text("selected_path"),
    selected_blueprint_level: text("selected_blueprint_level"),
    validation_verdict: text("validation_verdict"),
    validation_scores: jsonb("validation_scores"),
    validation_report: jsonb("validation_report"),
    path_options: jsonb("path_options"),
    blueprint_options: jsonb("blueprint_options"),
    commitment_level: commitmentLevelEnum("commitment_level"),
    mode: userModeEnum("mode").notNull().default("individual"),
    tier: userTierEnum("tier"),
    intelligence_depth: intelligenceDepthEnum("intelligence_depth"),
    selection_confirmed_at: timestamp("selection_confirmed_at", { withTimezone: true }),
    blueprint_config: jsonb("blueprint_config").notNull().default(sql`'{}'::jsonb`),
    operational_state: blueprintOperationalStateEnum("operational_state").default("ACTIVE"),
    current_domain: domainEnum("current_domain"),
    status: blueprintStatusEnum("status").notNull().default("draft"),
    active: boolean("active").notNull().default(false),
    current_condition: conditionEnum("current_condition"),
    current_plan_id: uuid("current_plan_id"),
    current_phase_id: uuid("current_phase_id"),
    current_project_id: uuid("current_project_id"),
    current_action_id: uuid("current_action_id"),
    // FK enforced in Postgres; omit Drizzle `.references()` to avoid circular infer() with `validations`.
    validation_id: uuid("validation_id"),
    erector_validation_id: uuid("erector_validation_id"),
    primary_archetype_id: uuid("primary_archetype_id").references(() => economicArchetypes.id),
    reality_score: doublePrecision("reality_score"),
    blueprint_tier: text("blueprint_tier"),
    industry_state: text("industry_state"),
    archetype_execution_mult: doublePrecision("archetype_execution_mult"),
    archetype_timeframe_mult: doublePrecision("archetype_timeframe_mult"),
    archetype_difficulty_adj: doublePrecision("archetype_difficulty_adj"),
    chosen_blueprint_level: text("chosen_blueprint_level"),
    economy_briefing_summary: text("economy_briefing_summary"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
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
    /** Cached market / positioning intelligence for UI and seeding hints */
    intel_metadata: jsonb("intel_metadata").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    index("idx_blueprints_user_id").on(t.user_id),
    index("idx_blueprints_status").on(t.status),
  ],
);

export const blueprintMembers = pgTable(
  "blueprint_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: teamRoleEnum("role").notNull().default("contributor"),
    domain: text("domain"),
    invited_by: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_blueprint_members_blueprint_id").on(t.blueprint_id),
    index("idx_blueprint_members_user_id").on(t.user_id),
  ],
);

export const blueprintTierMigrations = pgTable(
  "blueprint_tier_migrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    from_tier: userTierEnum("from_tier").notNull(),
    to_tier: userTierEnum("to_tier").notNull(),
    unlocked_systems: jsonb("unlocked_systems").notNull().default(sql`'[]'::jsonb`),
    migration_snapshot: jsonb("migration_snapshot").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_blueprint_tier_migrations_blueprint_id").on(t.blueprint_id)],
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
    user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    description: text("description"),
    purpose: text("purpose"),
    outcome: text("outcome"),
    order_index: integer("order_index").notNull(),
    status: planStatusEnum("status").notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
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
    user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    owner_id: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    contributor_ids: jsonb("contributor_ids").notNull().default(sql`'[]'::jsonb`),
    role_domain: text("role_domain"),
    trace_metadata: jsonb("trace_metadata").notNull().default(sql`'{}'::jsonb`),
    name: text("name").notNull(),
    title: text("title"),
    description: text("description"),
    type: targetTypeEnum("type").notNull(),
    target_type: text("target_type"),
    metric: text("metric"),
    metric_name: text("metric_name"),
    target_value: doublePrecision("target_value"),
    current_value: doublePrecision("current_value").notNull().default(0),
    unit: text("unit"),
    progress: doublePrecision("progress").notNull().default(0),
    order_index: integer("order_index").notNull().default(0),
    status: targetStatusEnum("status").notNull().default("pending"),
    due_date: timestamp("due_date", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
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
    user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: phaseNameEnum("name").notNull(),
    title: text("title"),
    description: text("description"),
    order_index: integer("order_index").notNull(),
    gate_criteria: jsonb("gate_criteria"),
    unlock_criteria: jsonb("unlock_criteria"),
    status: phaseStatusEnum("status").notNull().default("pending"),
    locked: boolean("locked").notNull().default(false),
    is_active: boolean("is_active").notNull().default(false),
    progress_percent: doublePrecision("progress_percent").notNull().default(0),
    gate_passed: boolean("gate_passed").notNull().default(false),
    trace_metadata: jsonb("trace_metadata").notNull().default(sql`'{}'::jsonb`),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
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
    user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    owner_id: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    assignee_ids: jsonb("assignee_ids").notNull().default(sql`'[]'::jsonb`),
    trace_metadata: jsonb("trace_metadata").notNull().default(sql`'{}'::jsonb`),
    name: text("name").notNull(),
    title: text("title"),
    description: text("description"),
    type: projectTypeEnum("type").notNull(),
    project_type: text("project_type"),
    is_blocked: boolean("is_blocked").notNull().default(false),
    blocked_reason: text("blocked_reason"),
    order_index: integer("order_index").notNull().default(0),
    status: projectStatusEnum("status").notNull().default("pending"),
    progress_percent: doublePrecision("progress_percent").notNull().default(0),
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
    user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    description: text("description"),
    type: actionTypeEnum("type").notNull(),
    action_type: text("action_type"),
    expected_output: text("expected_output"),
    knowledge_category: text("knowledge_category"),
    order_index: integer("order_index").notNull().default(0),
    status: text("status").notNull().default("pending"),
    trace_metadata: jsonb("trace_metadata").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
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
    user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    condition_id: uuid("condition_id"),
    signal_snapshot_id: uuid("signal_snapshot_id"),
    condition: conditionEnum("condition").notNull(),
    task_limits: jsonb("task_limits").notNull().default(sql`'{}'::jsonb`),
    difficulty_cap: difficultyEnum("difficulty_cap").notNull().default("moderate"),
    allowed_actions: text("allowed_actions").array().notNull().default(sql`ARRAY[]::text[]`),
    blocked_actions: text("blocked_actions").array().notNull().default(sql`ARRAY[]::text[]`),
    restricted_actions: jsonb("restricted_actions").notNull().default(sql`'[]'::jsonb`),
    phase_permission: phasePermissionEnum("phase_permission"),
    target_adjustment: targetAdjustmentEnum("target_adjustment"),
    ai_mode: aiModeEnum("ai_mode"),
    ui_mode: uiModeEnum("ui_mode"),
    feature_permissions: jsonb("feature_permissions").notNull().default(sql`'{}'::jsonb`),
    risk_level: riskLevelEnum("risk_level"),
    override_flags: jsonb("override_flags").notNull().default(sql`'{}'::jsonb`),
    cognitive_load_score: doublePrecision("cognitive_load_score"),
    recovery_required: boolean("recovery_required").notNull().default(false),
    progression_allowed: boolean("progression_allowed").notNull().default(true),
    state_version: integer("state_version").notNull().default(0),
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
    plan_id: uuid("plan_id").references(() => plans.id),
    phase_id: uuid("phase_id").references(() => phases.id),
    project_id: uuid("project_id").references(() => projects.id),
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
    context_why: text("context_why"),
    order_type: text("order_type"),
    why_it_matters: text("why_it_matters"),
    time_estimate_minutes: integer("time_estimate_minutes"),
    time_estimate_mins: integer("time_estimate_mins"),
    content_hash: text("content_hash"),
    knowledge_links: jsonb("knowledge_links"),
    /** Server-computed + optional Bhudhi copy: trace, proof wording, AI prompt hints (never authority). */
    command_context: jsonb("command_context").notNull().default(sql`'{}'::jsonb`),
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
    assigned_member_id: uuid("assigned_member_id").references(() => users.id, { onDelete: "set null" }),
    trace_metadata: jsonb("trace_metadata").notNull().default(sql`'{}'::jsonb`),
    status: orderStatusEnum("status").notNull().default("pending"),
    blocker_type: text("blocker_type"),
    blocker_description: text("blocker_description"),
    dependency_reference: text("dependency_reference"),
    output_summary: text("output_summary"),
    proof_json: jsonb("proof_json"),
    started_at: timestamp("started_at", { withTimezone: true }),
    finished_at: timestamp("finished_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    due_at: timestamp("due_at", { withTimezone: true }),
    due_date: timestamp("due_date", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_orders_blueprint_id").on(t.blueprint_id),
    index("idx_orders_action_id").on(t.action_id),
    index("idx_orders_status").on(t.status),
    index("idx_orders_blueprint_status").on(t.blueprint_id, t.status),
  ],
);

// ── GROUP 3 — DEPENDENCIES ──────────────────────────────────────────────────

export const projectDependencies = pgTable(
  "project_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    blocking_project_id: uuid("blocking_project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    blocked_project_id: uuid("blocked_project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    dependency_type: text("dependency_type").notNull().default("SEQUENTIAL"),
    status: text("status").notNull().default("PENDING"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
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
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    blocking_order_id: uuid("blocking_order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    blocked_order_id: uuid("blocked_order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    dependency_type: text("dependency_type").notNull().default("SEQUENTIAL"),
    status: text("status").notNull().default("pending"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uniq_order_dependency").on(t.blocking_order_id, t.blocked_order_id),
    index("idx_order_dependencies_blocked_status").on(t.blocked_order_id, t.status),
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
    late_penalty_applied: boolean("late_penalty_applied").notNull().default(false),
    failure_classification: text("failure_classification"),
    failure_correction_type: text("failure_correction_type"),
    difficulty_felt: text("difficulty_felt"),
    submitted_hours_after_completion: doublePrecision("submitted_hours_after_completion"),
    validity: text("validity").notNull().default("valid"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_feedback_order_id").on(t.order_id),
    index("idx_feedback_blueprint_id").on(t.blueprint_id),
    index("idx_feedback_blueprint_created_at").on(t.blueprint_id, t.created_at),
    index("idx_feedback_user_id").on(t.user_id),
  ],
);

// ── GROUP 5 — SIGNAL & CONTROL ──────────────────────────────────────────────

/** GAP G8 — append-only external signal audit trail (DOC_27). */
export const externalSignals = pgTable(
  "external_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, {
      onDelete: "set null",
    }),
    source_type: text("source_type").notNull(),
    source_name: text("source_name").notNull(),
    trust_level: text("trust_level").notNull().default("UNTRUSTED"),
    confidence: doublePrecision("confidence").notNull().default(0),
    signal_type: text("signal_type"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    normalized_payload: jsonb("normalized_payload"),
    status: text("status").notNull().default("PENDING"),
    rejection_reason: text("rejection_reason"),
    received_at: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processed_at: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_external_signals_user_id").on(t.user_id),
    index("idx_external_signals_blueprint_id").on(t.blueprint_id),
    index("idx_external_signals_source_name").on(t.source_name),
    index("idx_external_signals_status").on(t.status),
  ],
);

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
    processed_at: timestamp("processed_at", { withTimezone: true }),
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
    week_start: timestamp("week_start", { withTimezone: true }),
    window_end: timestamp("window_end", { withTimezone: true }).notNull(),
    completion_rate: doublePrecision("completion_rate").notNull(),
    weighted_score: doublePrecision("weighted_score").notNull(),
    daily_score: doublePrecision("daily_score").notNull().default(0),
    momentum: integer("momentum").notNull(),
    trend: signalTrendEnum("trend").notNull().default("stable"),
    confidence: signalConfidenceEnum("confidence").notNull().default("insufficient_data"),
    blocker_ratio: doublePrecision("blocker_ratio").notNull().default(0),
    skip_ratio: doublePrecision("skip_ratio").notNull().default(0),
    consistency: doublePrecision("consistency").notNull().default(0),
    velocity: doublePrecision("velocity").notNull().default(0),
    streak_days: integer("streak_days").notNull().default(0),
    window_days: integer("window_days").notNull().default(7),
    data_points: integer("data_points").notNull().default(0),
    computed_at: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    state_version: integer("state_version").notNull().default(0),
    /** Deterministic operational mathematics (10+ scores, formulas, thresholds) — Prompt / Phase 2 core. */
    operational_mathematics_json: jsonb("operational_mathematics_json").notNull().default(sql`'{}'::jsonb`),
    assigned_condition: conditionEnum("assigned_condition"),
    condition: text("condition"),
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
    reason: text("reason"),
    source: text("source"),
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

export const conditionRecords = pgTable(
  "condition_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    is_current: boolean("is_current").notNull().default(false),
    condition: conditionEnum("condition").notNull().default("nothingness"),
    previous_condition: conditionEnum("previous_condition"),
    escalation_level: integer("escalation_level").notNull().default(0),
    duration_days: doublePrecision("duration_days").notNull().default(0),
    recovery_required: boolean("recovery_required").notNull().default(false),
    transitioned_at: timestamp("transitioned_at", { withTimezone: true }).notNull().defaultNow(),
    state_version: integer("state_version").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_condition_records_blueprint_id").on(t.blueprint_id),
    index("idx_condition_records_blueprint_current").on(t.blueprint_id, t.is_current),
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
    failure_class: text("failure_class").notNull().default("transient"),
    retry_count: integer("retry_count").notNull(),
    last_error: text("last_error"),
    resolution_status: text("resolution_status").notNull().default("OPEN"),
    requires_manual: boolean("requires_manual").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewed: boolean("reviewed").notNull().default(false),
    reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
    resolved: boolean("resolved").notNull().default(false),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
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
  current_level: text("current_level").notNull().default("beginner"),
  consistency_score: doublePrecision("consistency_score").notNull().default(0),
  execution_quality: doublePrecision("execution_quality").notNull().default(0),
  throughput: throughputEnum("throughput").notNull().default("low"),
  recovery_rate: doublePrecision("recovery_rate").notNull().default(0),
  fatigue_risk: fatigueRiskEnum("fatigue_risk").notNull().default("low"),
  current_difficulty: difficultyEnum("current_difficulty").notNull().default("easy"),
  tasks_completed: integer("tasks_completed").notNull().default(0),
  tasks_failed: integer("tasks_failed").notNull().default(0),
  streak_current: integer("streak_current").notNull().default(0),
  streak_count: integer("streak_count").notNull().default(0),
  streak_best: integer("streak_best").notNull().default(0),
  identity_type: text("identity_type"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    inactivity_type: text("inactivity_type"),
    severity: text("severity"),
    last_feedback_at: timestamp("last_feedback_at", { withTimezone: true }),
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
    stability_score: doublePrecision("stability_score").notNull().default(0),
    continuity_score: doublePrecision("continuity_score").notNull().default(0),
    regression_risk: text("regression_risk").notNull().default("LOW"),
    evidence_count: integer("evidence_count").notNull().default(0),
    last_evidence_at: timestamp("last_evidence_at", { withTimezone: true }),
    previous_stage: text("previous_stage"),
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
    idempotency_key: text("idempotency_key").notNull(),
    reward_type: text("reward_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    ui_action: text("ui_action"),
    delivered: boolean("delivered").notNull().default(false),
    delivered_at: timestamp("delivered_at", { withTimezone: true }),
    message: text("message"),
    evidence_summary: text("evidence_summary"),
    reward_level: text("reward_level").default("MINOR"),
    source_event_id: uuid("source_event_id"),
    intensity: text("intensity"),
    seen: boolean("seen").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_reward_events_user_id").on(t.user_id),
    index("idx_reward_events_delivered").on(t.delivered),
    index("idx_reward_events_source_event_id").on(t.source_event_id),
    uniqueIndex("uniq_reward_events_idempotency").on(t.idempotency_key),
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
    streak_count: integer("streak_count").notNull().default(0),
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
    user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
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

export const skillProfiles = pgTable(
  "skill_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: text("domain").notNull().default("Content"),
    skill_scores: jsonb("skill_scores").notNull().default(sql`'{}'::jsonb`),
    detected_gaps: jsonb("detected_gaps").notNull().default(sql`'[]'::jsonb`),
    mastered_skills: jsonb("mastered_skills").notNull().default(sql`'[]'::jsonb`),
    last_assessment: timestamp("last_assessment", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("idx_skill_profiles_user_id").on(t.user_id)],
);

export const learningPaths = pgTable(
  "learning_paths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "set null" }),
    skill_gap: text("skill_gap").notNull(),
    domain: text("domain").notNull(),
    path_status: text("path_status").notNull().default("ACTIVE"),
    lessons: jsonb("lessons").notNull().default(sql`'[]'::jsonb`),
    total_lessons: integer("total_lessons").notNull().default(0),
    completed_lessons: integer("completed_lessons").notNull().default(0),
    mastery_score: doublePrecision("mastery_score"),
    mastery_evidence: text("mastery_evidence"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("idx_learning_paths_user_status").on(t.user_id, t.path_status)],
);

export const capabilityGapLogs = pgTable(
  "capability_gap_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "set null" }),
    order_id: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    gap_type: text("gap_type").notNull(),
    detected_from: text("detected_from").notNull().default("FAILURE_CLASSIFICATION"),
    severity: text("severity").notNull().default("MEDIUM"),
    learning_path_id: uuid("learning_path_id").references(() => learningPaths.id, {
      onDelete: "set null",
    }),
    resolved: boolean("resolved").notNull().default(false),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    metadata_json: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_capability_gap_logs_user_resolved").on(t.user_id, t.resolved)],
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
    learning_path_id: uuid("learning_path_id").references(() => learningPaths.id, {
      onDelete: "set null",
    }),
    knowledge_id: text("knowledge_id").references(() => knowledgeObjects.id),
    title: text("title").notNull(),
    description: text("description"),
    learning_content: text("learning_content"),
    trigger_reason: text("trigger_reason").notNull(),
    domain: text("domain"),
    skill_target: text("skill_target"),
    skill_category: text("skill_category"),
    lesson_number: integer("lesson_number"),
    lesson_objective: text("lesson_objective"),
    mastery_definition: text("mastery_definition"),
    practice_type: text("practice_type"),
    completion_score: doublePrecision("completion_score"),
    skill_delta: doublePrecision("skill_delta"),
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
    outcome_type: text("outcome_type"),
    claimed_value: text("claimed_value"),
    evidence_text: text("evidence_text"),
    proof_json: jsonb("proof_json").default(sql`'{}'::jsonb`),
    validation_status: text("validation_status").notNull().default("pending"),
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
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    target_id: uuid("target_id").references(() => targets.id, { onDelete: "set null" }),
    real_outcome_id: uuid("real_outcome_id").references(() => realOutcomes.id, {
      onDelete: "set null",
    }),
    validation_result: text("validation_result"),
    evidence_score: doublePrecision("evidence_score"),
    evidence_summary: text("evidence_summary"),
    validator_source: text("validator_source").default("SYSTEM"),
    validated_at: timestamp("validated_at", { withTimezone: true }),
    tasks_completed: integer("tasks_completed").notNull().default(0),
    outcomes_verified: integer("outcomes_verified").notNull().default(0),
    alignment_score: doublePrecision("alignment_score").notNull().default(0),
    verdict: text("verdict"),
    notes: text("notes"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_outcome_validations_blueprint_id").on(t.blueprint_id),
    index("idx_outcome_validations_validation_result").on(
      t.blueprint_id,
      t.validation_result,
    ),
  ],
);

export const falseProgressFlags = pgTable(
  "false_progress_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    detection_type: text("detection_type").notNull(),
    evidence_json: jsonb("evidence_json").notNull().default(sql`'{}'::jsonb`),
    severity: text("severity"),
    status: text("status").notNull().default("active"),
    resolution_task_id: uuid("resolution_task_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    resolved: boolean("resolved").notNull().default(false),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
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
    state_version: integer("state_version").notNull().default(0),
    payload: jsonb("payload"),
    current_state: jsonb("current_state").notNull().default(sql`'{}'::jsonb`),
    last_event: text("last_event"),
    entered_at: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    exited_at: timestamp("exited_at", { withTimezone: true }),
    duration_days: integer("duration_days").notNull().default(0),
    escalation_level: integer("escalation_level").notNull().default(0),
    is_current: boolean("is_current").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
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
    knowledge_injected: boolean("knowledge_injected").notNull().default(false),
    knowledge_package_id: uuid("knowledge_package_id"),
    debate_used: boolean("debate_used").notNull().default(false),
    generation_ms: integer("generation_ms"),
    control_rule_applied: jsonb("control_rule_applied").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_task_generation_log_blueprint_id").on(t.blueprint_id),
    index("idx_task_generation_log_trigger").on(t.generation_trigger),
  ],
);

export const taskGenerationLogs = pgTable(
  "task_generation_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    order_id: uuid("order_id"),
    generation_mode: text("generation_mode").notNull(),
    generation_trigger: text("generation_trigger"),
    task_type: text("task_type"),
    difficulty: text("difficulty"),
    bhudhi_used: boolean("bhudhi_used").notNull().default(false),
    fallback_used: boolean("fallback_used").notNull().default(false),
    result: text("result").notNull().default("success"),
    error_message: text("error_message"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_task_generation_logs_blueprint_id").on(t.blueprint_id),
    index("idx_task_generation_logs_user_id").on(t.user_id),
  ],
);

export const decisionTraces = pgTable(
  "decision_traces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    decision_type: text("decision_type").notNull(),
    entity_type: text("entity_type"),
    entity_id: uuid("entity_id"),
    reasoning: text("reasoning").notNull(),
    input_summary: text("input_summary"),
    output_summary: text("output_summary"),
    alternatives_considered: jsonb("alternatives_considered").default(sql`'[]'::jsonb`),
    state_version: integer("state_version"),
    inputs_json: jsonb("inputs_json").notNull().default(sql`'{}'::jsonb`),
    outputs_json: jsonb("outputs_json").notNull().default(sql`'{}'::jsonb`),
    engine: text("engine"),
    engine_source: text("engine_source"),
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
    choice_count: integer("choice_count"),
    decision_latency_ms: integer("decision_latency_ms"),
    reversal_count: integer("reversal_count"),
    ambiguity_flags: integer("ambiguity_flags"),
    load_category: text("load_category"),
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
    /** B3: summarized text for prompts (never raw DB dumps). */
    content: text("content"),
    content_json: jsonb("content_json").notNull().default(sql`'{}'::jsonb`),
    scope: text("scope"),
    source_type: text("source_type"),
    source_id: uuid("source_id"),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    relevance_score: doublePrecision("relevance_score").notNull().default(0.5),
    reinforcement_count: integer("reinforcement_count").notNull().default(1),
    last_reinforced_at: timestamp("last_reinforced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    disabled_at: timestamp("disabled_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    is_compressed: boolean("is_compressed").notNull().default(false),
    source_event_id: text("source_event_id"),
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

export const worldModels = pgTable(
  "world_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    user_state: jsonb("user_state").notNull().default(sql`'{}'::jsonb`),
    goal_state: jsonb("goal_state").notNull().default(sql`'{}'::jsonb`),
    signal_trajectory: jsonb("signal_trajectory").notNull().default(sql`'{}'::jsonb`),
    motivation_state: jsonb("motivation_state").notNull().default(sql`'{}'::jsonb`),
    market_state: jsonb("market_state").notNull().default(sql`'{}'::jsonb`),
    identity_state: jsonb("identity_state").notNull().default(sql`'{}'::jsonb`),
    environmental_state: jsonb("environmental_state").notNull().default(sql`'{}'::jsonb`),
    state_version: integer("state_version").notNull().default(0),
    last_drift_calculation: timestamp("last_drift_calculation", { withTimezone: true }),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("idx_world_models_user_id").on(t.user_id)],
);

export const agentRegistry = pgTable("agent_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_name: text("agent_name").notNull().unique(),
  status: text("status").notNull().default("ACTIVE"),
  activation_phase: text("activation_phase").notNull().default("P1"),
  trigger_types: text("trigger_types").array().notNull().default(sql`ARRAY[]::text[]`),
  output_contract: text("output_contract").notNull(),
  last_activated: timestamp("last_activated", { withTimezone: true }),
  total_activations: integer("total_activations").notNull().default(0),
  average_latency_ms: doublePrecision("average_latency_ms"),
  quality_score: doublePrecision("quality_score"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const predictionLogs = pgTable(
  "prediction_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "cascade" }),
    agent_name: text("agent_name").notNull(),
    prediction_type: text("prediction_type").notNull(),
    prediction: jsonb("prediction").notNull().default(sql`'{}'::jsonb`),
    confidence_level: doublePrecision("confidence_level").notNull().default(0.5),
    confidence_tier: text("confidence_tier").notNull().default("MEDIUM"),
    predicted_outcome: jsonb("predicted_outcome"),
    actual_outcome: jsonb("actual_outcome"),
    accuracy_score: doublePrecision("accuracy_score"),
    verification_date: timestamp("verification_date", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_prediction_logs_user_id").on(t.user_id)],
);

export const contradictionRecords = pgTable(
  "contradiction_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    contradiction_type: text("contradiction_type").notNull(),
    description: text("description").notNull(),
    elements: jsonb("elements").notNull().default(sql`'[]'::jsonb`),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("PENDING"),
    acknowledged_at: timestamp("acknowledged_at", { withTimezone: true }),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_contradiction_records_blueprint_id").on(t.blueprint_id),
    index("idx_contradiction_records_user_id").on(t.user_id),
  ],
);

export const governanceQueue = pgTable(
  "governance_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    proposal_type: text("proposal_type").notNull(),
    proposing_agent: text("proposing_agent").notNull().default("BLUEPRINT"),
    proposal_content: jsonb("proposal_content").notNull().default(sql`'{}'::jsonb`),
    rationale: text("rationale").notNull(),
    evidence_citations: jsonb("evidence_citations").notNull().default(sql`'[]'::jsonb`),
    impact_assessment: jsonb("impact_assessment").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("PENDING"),
    priority: text("priority").notNull().default("NORMAL"),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    approved_at: timestamp("approved_at", { withTimezone: true }),
    rejected_at: timestamp("rejected_at", { withTimezone: true }),
    approval_note: text("approval_note"),
    world_state_version: integer("world_state_version").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_governance_queue_blueprint_id").on(t.blueprint_id),
    index("idx_governance_queue_status").on(t.blueprint_id, t.status),
  ],
);

export const blueprintHealthRecords = pgTable(
  "blueprint_health_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    health_score: doublePrecision("health_score").notNull(),
    phase_progress_rate: doublePrecision("phase_progress_rate").notNull().default(0),
    target_achievement_rate: doublePrecision("target_achievement_rate").notNull().default(0),
    action_coverage_rate: doublePrecision("action_coverage_rate").notNull().default(0),
    gaps_detected: jsonb("gaps_detected").notNull().default(sql`'[]'::jsonb`),
    dead_actions_count: integer("dead_actions_count").notNull().default(0),
    stagnant_phases_count: integer("stagnant_phases_count").notNull().default(0),
    weak_targets_count: integer("weak_targets_count").notNull().default(0),
    proposals_generated: integer("proposals_generated").notNull().default(0),
    agent_assessment: text("agent_assessment").notNull(),
    confidence_tier: text("confidence_tier").notNull().default("MEDIUM"),
    world_state_version: integer("world_state_version").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_blueprint_health_records_blueprint_id").on(t.blueprint_id)],
);

export const dashboardIntelligenceSnapshots = pgTable(
  "dashboard_intelligence_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    strategic_outlook: jsonb("strategic_outlook"),
    behavioral_insight: jsonb("behavioral_insight"),
    blueprint_health: jsonb("blueprint_health"),
    signal_narrative: jsonb("signal_narrative"),
    execution_brief: jsonb("execution_brief"),
    governance_summary: jsonb("governance_summary"),
    last_refreshed: timestamp("last_refreshed", { withTimezone: true }).notNull().defaultNow(),
    snapshot_version: integer("snapshot_version").notNull().default(1),
    world_state_version: integer("world_state_version").notNull().default(0),
  },
  (t) => [index("idx_dashboard_intelligence_user").on(t.user_id)],
);

export const strategicOutlookRecords = pgTable(
  "strategic_outlook_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    execution_forecast: text("execution_forecast").notNull(),
    risk_factors: jsonb("risk_factors").notNull().default(sql`'[]'::jsonb`),
    opportunity_flags: jsonb("opportunity_flags").notNull().default(sql`'[]'::jsonb`),
    highest_leverage_action: text("highest_leverage_action").notNull(),
    condition_prediction: text("condition_prediction").notNull(),
    momentum_trajectory: text("momentum_trajectory").notNull().default("STABLE"),
    confidence_tier: text("confidence_tier").notNull().default("LOW"),
    generated_at: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("idx_strategic_outlook_user_generated").on(t.user_id, t.generated_at),
    index("idx_strategic_outlook_expires").on(t.expires_at),
  ],
);

export const behavioralInsightRecords = pgTable(
  "behavioral_insight_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    insight_type: text("insight_type").notNull(),
    insight_text: text("insight_text").notNull(),
    evidence_summary: text("evidence_summary").notNull(),
    action_suggestion: text("action_suggestion"),
    trigger_event: text("trigger_event").notNull(),
    seen: boolean("seen").notNull().default(false),
    dismissed: boolean("dismissed").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_behavioral_insights_user_seen").on(t.user_id, t.seen, t.dismissed),
    index("idx_behavioral_insights_created").on(t.created_at),
  ],
);

export const blueprintInterpretations = pgTable(
  "blueprint_interpretations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .unique()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    interpretation: text("interpretation").notNull(),
    key_insights: jsonb("key_insights").notNull().default(sql`'[]'::jsonb`),
    current_focus: text("current_focus").notNull(),
    next_milestone: text("next_milestone").notNull(),
    risk_flags: jsonb("risk_flags").notNull().default(sql`'[]'::jsonb`),
    confidence_tier: text("confidence_tier").notNull().default("MEDIUM"),
    world_state_version: integer("world_state_version").notNull().default(0),
    generated_at: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("idx_blueprint_interpretations_blueprint_id").on(t.blueprint_id)],
);

export const morningReports = pgTable(
  "morning_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "cascade" }),
    report_date: text("report_date").notNull(),
    eis_section: jsonb("eis_section"),
    signal_summary: jsonb("signal_summary").notNull().default(sql`'{}'::jsonb`),
    next_task_preview: jsonb("next_task_preview"),
    report_body: jsonb("report_body").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_morning_reports_user_id").on(t.user_id),
    uniqueIndex("idx_morning_reports_user_date").on(t.user_id, t.report_date),
  ],
);

export const systemHealthLogs = pgTable(
  "system_health_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    area: text("area"),
    severity: text("severity"),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    entity_type: text("entity_type"),
    entity_id: text("entity_id"),
    /** Issue identifier (DOC_17 issue_code); legacy name check_type. */
    check_type: text("check_type").notNull(),
    message: text("message"),
    status: text("status").notNull(),
    score: doublePrecision("score"),
    details_json: jsonb("details_json").notNull().default(sql`'{}'::jsonb`),
    issues_detected: text("issues_detected").array().notNull().default(sql`ARRAY[]::text[]`),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_system_health_logs_blueprint_id").on(t.blueprint_id),
    index("idx_system_health_logs_check_type").on(t.check_type),
    index("idx_system_health_logs_area").on(t.area),
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

export const validationMemory = pgTable(
  "validation_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    validation_id: uuid("validation_id").references(() => validations.id),
    goal_hash: text("goal_hash").notNull(),
    raw_goal_snapshot: text("raw_goal_snapshot"),
    verdict: text("verdict"),
    clarity_score: doublePrecision("clarity_score"),
    feasibility_score: doublePrecision("feasibility_score"),
    realism_score: doublePrecision("realism_score"),
    industry_label: text("industry_label"),
    selected_path: text("selected_path"),
    payload_json: jsonb("payload_json").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_validation_memory_user_id").on(t.user_id),
    index("idx_validation_memory_goal_hash").on(t.goal_hash),
    index("idx_validation_memory_blueprint_id").on(t.blueprint_id),
  ],
);

export const validationEventLogs = pgTable(
  "validation_event_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_id: uuid("validation_id")
      .notNull()
      .references(() => validations.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    status: text("status").notNull(),
    message: text("message"),
    confidence: integer("confidence"),
    retry_count: integer("retry_count").notNull().default(0),
    payload_json: jsonb("payload_json").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_validation_event_logs_validation_id").on(t.validation_id),
    index("idx_validation_event_logs_created_at").on(t.created_at),
  ],
);

export const verdictEvolution = pgTable(
  "verdict_evolution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_id: uuid("validation_id")
      .notNull()
      .references(() => validations.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    previous_verdict: text("previous_verdict"),
    new_verdict: text("new_verdict").notNull(),
    change_summary: text("change_summary"),
    improved: boolean("improved"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_verdict_evolution_blueprint_id").on(t.blueprint_id)],
);

export const eisRateLimits = pgTable(
  "eis_rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    industry: text("industry").notNull(),
    niche: text("niche").notNull(),
    last_call_at: timestamp("last_call_at", { withTimezone: true }).notNull().defaultNow(),
    cached_payload: jsonb("cached_payload"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_eis_rate_limits_user_industry").on(t.user_id, t.industry, t.niche),
  ],
);

export const eisCallLogs = pgTable(
  "eis_call_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    validation_id: uuid("validation_id").references(() => validations.id),
    industry: text("industry"),
    niche: text("niche"),
    tokens_used: integer("tokens_used"),
    estimated_cost_usd: doublePrecision("estimated_cost_usd"),
    model_used: text("model_used"),
    cache_hit: boolean("cache_hit").notNull().default(false),
    low_confidence: boolean("low_confidence").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_eis_call_logs_user_id").on(t.user_id),
    index("idx_eis_call_logs_created_at").on(t.created_at),
  ],
);

export const competitorIntelligence = pgTable(
  "competitor_intelligence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    niche: text("niche"),
    competitors: jsonb("competitors").notNull().default(sql`'[]'::jsonb`),
    activity_window: text("activity_window").notNull().default("24h"),
    key_findings: jsonb("key_findings").notNull().default(sql`'[]'::jsonb`),
    threat_level: text("threat_level").notNull().default("LOW"),
    opportunity_flags: jsonb("opportunity_flags").notNull().default(sql`'[]'::jsonb`),
    research_method: text("research_method").notNull().default("FALLBACK"),
    confidence_tier: text("confidence_tier").notNull().default("LOW"),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_competitor_intelligence_user_created").on(t.user_id, t.created_at),
    index("idx_competitor_intelligence_expires").on(t.expires_at),
  ],
);

export const trendIntelligence = pgTable(
  "trend_intelligence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    niche: text("niche"),
    trends: jsonb("trends").notNull().default(sql`'[]'::jsonb`),
    velocity_scores: jsonb("velocity_scores").notNull().default(sql`'[]'::jsonb`),
    emerging_trends: jsonb("emerging_trends").notNull().default(sql`'[]'::jsonb`),
    peaking_trends: jsonb("peaking_trends").notNull().default(sql`'[]'::jsonb`),
    declining_trends: jsonb("declining_trends").notNull().default(sql`'[]'::jsonb`),
    opportunity_windows: jsonb("opportunity_windows").notNull().default(sql`'[]'::jsonb`),
    research_method: text("research_method").notNull().default("FALLBACK"),
    confidence_tier: text("confidence_tier").notNull().default("LOW"),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_trend_intelligence_user_created").on(t.user_id, t.created_at),
    index("idx_trend_intelligence_expires").on(t.expires_at),
  ],
);

export const narrativeIntelligence = pgTable(
  "narrative_intelligence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    niche: text("niche"),
    dominant_narrative: text("dominant_narrative").notNull(),
    emerging_narratives: jsonb("emerging_narratives").notNull().default(sql`'[]'::jsonb`),
    sentiment_signal: text("sentiment_signal").notNull().default("NEUTRAL"),
    audience_emotions: jsonb("audience_emotions").notNull().default(sql`'[]'::jsonb`),
    content_angle: text("content_angle").notNull(),
    risk_narratives: jsonb("risk_narratives").notNull().default(sql`'[]'::jsonb`),
    research_method: text("research_method").notNull().default("FALLBACK"),
    confidence_tier: text("confidence_tier").notNull().default("LOW"),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_narrative_intelligence_user_created").on(t.user_id, t.created_at),
    index("idx_narrative_intelligence_expires").on(t.expires_at),
  ],
);

export const platformAlgorithmSignals = pgTable(
  "platform_algorithm_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: text("platform").notNull(),
    signal_type: text("signal_type").notNull().default("UNKNOWN"),
    content_category: text("content_category").notNull(),
    signal_strength: doublePrecision("signal_strength").notNull().default(0.5),
    confidence_tier: text("confidence_tier").notNull().default("LOW"),
    source_evidence: text("source_evidence").notNull(),
    recommendation: text("recommendation").notNull(),
    valid_until: timestamp("valid_until", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_platform_algorithm_signals_platform").on(t.platform),
    index("idx_platform_algorithm_signals_valid_until").on(t.valid_until),
  ],
);

export const strategicAssumptions = pgTable(
  "strategic_assumptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    validation_id: uuid("validation_id").references(() => validations.id),
    assumption_text: text("assumption_text").notNull(),
    industry_context: text("industry_context"),
    monitoring_status: text("monitoring_status").notNull().default("active"),
    last_reviewed_at: timestamp("last_reviewed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_strategic_assumptions_blueprint_id").on(t.blueprint_id),
    index("idx_strategic_assumptions_status").on(t.monitoring_status),
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

// ── GROUP 12 — BHUDHI PHASE 4 (STABILITY · CRITIC · DEBATE) ─────────────────

export const stabilityEvents = pgTable(
  "stability_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    event_type: text("event_type").notNull(),
    severity: text("severity").notNull().default("MEDIUM"),
    description: text("description").notNull(),
    agent_involved: text("agent_involved"),
    trigger_type: text("trigger_type"),
    resolution: text("resolution").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_stability_events_user_id").on(t.user_id),
    index("idx_stability_events_created_at").on(t.created_at),
  ],
);

export const agentConflictLogs = pgTable(
  "agent_conflict_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agent_a: text("agent_a").notNull(),
    agent_b: text("agent_b").notNull(),
    trigger_type: text("trigger_type").notNull(),
    agent_a_output: jsonb("agent_a_output").notNull().default(sql`'{}'::jsonb`),
    agent_b_output: jsonb("agent_b_output").notNull().default(sql`'{}'::jsonb`),
    conflict_type: text("conflict_type").notNull(),
    resolution: text("resolution").notNull(),
    resolved_output: jsonb("resolved_output").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_agent_conflict_logs_user_id").on(t.user_id)],
);

export const criticReviewLogs = pgTable(
  "critic_review_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bhudhi_log_id: uuid("bhudhi_log_id")
      .notNull()
      .references(() => bhudhiLogs.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reviewing_agent: text("reviewing_agent").notNull().default("CRITIC"),
    input_agent: text("input_agent").notNull(),
    verdict: text("verdict").notNull(),
    confidence_score: doublePrecision("confidence_score").notNull().default(0.5),
    confidence_tier: text("confidence_tier").notNull().default("MEDIUM"),
    rejection_reason: text("rejection_reason"),
    flag_reason: text("flag_reason"),
    governance_violation: boolean("governance_violation").notNull().default(false),
    violation_detail: text("violation_detail"),
    revised_output: jsonb("revised_output"),
    revision_count: integer("revision_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_critic_review_logs_bhudhi_log_id").on(t.bhudhi_log_id),
    index("idx_critic_review_logs_user_id").on(t.user_id),
  ],
);

export const debateLogs = pgTable(
  "debate_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trigger_type: text("trigger_type").notNull(),
    debate_topic: text("debate_topic").notNull(),
    rounds: jsonb("rounds").notNull().default(sql`'[]'::jsonb`),
    consensus_reached: boolean("consensus_reached").notNull().default(false),
    final_verdict: jsonb("final_verdict").notNull().default(sql`'{}'::jsonb`),
    judge_rationale: text("judge_rationale").notNull().default(""),
    debate_duration_ms: integer("debate_duration_ms").notNull().default(0),
    agents_involved: text("agents_involved").array().notNull().default(sql`ARRAY[]::text[]`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_debate_logs_user_id").on(t.user_id)],
);

export const metaCognitionProfiles = pgTable("meta_cognition_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_name: text("agent_name").notNull().unique(),
  domain_reliability: jsonb("domain_reliability").notNull().default(sql`'[]'::jsonb`),
  prediction_accuracy: doublePrecision("prediction_accuracy").notNull().default(0.5),
  total_predictions: integer("total_predictions").notNull().default(0),
  correct_predictions: integer("correct_predictions").notNull().default(0),
  hallucination_risk: doublePrecision("hallucination_risk").notNull().default(0.2),
  strong_domains: text("strong_domains").array().notNull().default(sql`ARRAY[]::text[]`),
  weak_domains: text("weak_domains").array().notNull().default(sql`ARRAY[]::text[]`),
  last_calibration_update: timestamp("last_calibration_update", { withTimezone: true })
    .notNull()
    .defaultNow(),
  calibration_version: integer("calibration_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fallbackUsageLogs = pgTable(
  "fallback_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trigger_type: text("trigger_type").notNull(),
    prompt_name: text("prompt_name").notNull(),
    reason: text("reason").notNull(),
    fallback_type: text("fallback_type").notNull().default("DETERMINISTIC_TEMPLATE"),
    user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    bhudhi_log_id: uuid("bhudhi_log_id").references(() => bhudhiLogs.id, { onDelete: "set null" }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_fallback_usage_logs_created_at").on(t.created_at)],
);

// ── GROUP 13 — BHUDHI PHASE 5 (EXECUTION LOOP · KNOWLEDGE) ───────────────────

export const executionSessions = pgTable(
  "execution_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    session_type: text("session_type").notNull().default("PRIMARY"),
    started_at: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    ended_at: timestamp("ended_at", { withTimezone: true }),
    tasks_generated: integer("tasks_generated").notNull().default(0),
    tasks_completed: integer("tasks_completed").notNull().default(0),
    feedback_cycles: integer("feedback_cycles").notNull().default(0),
    signal_updates: integer("signal_updates").notNull().default(0),
    session_health: text("session_health").notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_execution_sessions_user_id").on(t.user_id),
    index("idx_execution_sessions_blueprint_id").on(t.blueprint_id),
  ],
);

export const knowledgePackages = pgTable(
  "knowledge_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull(),
    action_type: text("action_type").notNull(),
    phase: text("phase"),
    sop: text("sop"),
    benchmark: text("benchmark"),
    tool_recommendations: text("tool_recommendations").array().notNull().default(sql`ARRAY[]::text[]`),
    common_mistakes: text("common_mistakes").array().notNull().default(sql`ARRAY[]::text[]`),
    good_output_example: text("good_output_example"),
    execution_guidance: text("execution_guidance"),
    eis_enriched: boolean("eis_enriched").notNull().default(false),
    version: integer("version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("idx_knowledge_packages_domain_action").on(t.domain, t.action_type)],
);

export const continuousTaskGuaranteeLogs = pgTable(
  "continuous_task_guarantee_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id, { onDelete: "set null" }),
    trigger_reason: text("trigger_reason").notNull(),
    blocker_type: text("blocker_type").notNull(),
    task_type_generated: text("task_type_generated").notNull(),
    order_id: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_continuous_task_guarantee_logs_user").on(t.user_id)],
);

// ── GROUP 14 — BHUDHI PHASE 7 (PSYCHOLOGY LAYER) ─────────────────────────────

export const identityProfiles = pgTable(
  "identity_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    self_image: text("self_image"),
    identity_stage: text("identity_stage").notNull().default("FORMING"),
    confidence_score: doublePrecision("confidence_score").notNull().default(0.5),
    confidence_trend: text("confidence_trend").notNull().default("STABLE"),
    purpose_alignment: doublePrecision("purpose_alignment").notNull().default(0.5),
    primary_identity: text("primary_identity"),
    aspirational_identity: text("aspirational_identity"),
    execution_identity: text("execution_identity"),
    active_conflicts: jsonb("active_conflicts").notNull().default(sql`'[]'::jsonb`),
    conflict_count: integer("conflict_count").notNull().default(0),
    milestones_reached: jsonb("milestones_reached").notNull().default(sql`'[]'::jsonb`),
    last_milestone_at: timestamp("last_milestone_at", { withTimezone: true }),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("idx_identity_profiles_user_id").on(t.user_id)],
);

export const characterProgression = pgTable(
  "character_progression",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    consistency: doublePrecision("consistency").notNull().default(0),
    grit: doublePrecision("grit").notNull().default(0),
    discipline: doublePrecision("discipline").notNull().default(0),
    execution_intelligence: doublePrecision("execution_intelligence").notNull().default(0),
    adaptability: doublePrecision("adaptability").notNull().default(0),
    overall_character_score: doublePrecision("overall_character_score").notNull().default(0),
    character_level: integer("character_level").notNull().default(1),
    trait_history: jsonb("trait_history").notNull().default(sql`'[]'::jsonb`),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("idx_character_progression_user_id").on(t.user_id)],
);

export const burnoutRecords = pgTable(
  "burnout_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    risk_level: text("risk_level").notNull(),
    risk_score: doublePrecision("risk_score").notNull(),
    evidence_factors: jsonb("evidence_factors").notNull().default(sql`'[]'::jsonb`),
    completion_rate_drop: doublePrecision("completion_rate_drop"),
    score_divergence: doublePrecision("score_divergence"),
    reflection_quality_drop: doublePrecision("reflection_quality_drop"),
    consecutive_declines: integer("consecutive_declines"),
    session_frequency_drop: doublePrecision("session_frequency_drop"),
    recommendation: text("recommendation").notNull(),
    action_taken: text("action_taken"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_burnout_records_user_created").on(t.user_id, t.created_at)],
);

export const failureClassifications = pgTable(
  "failure_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    order_id: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    feedback_id: uuid("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    primary_candidate: text("primary_candidate").notNull(),
    primary_likelihood: doublePrecision("primary_likelihood").notNull(),
    secondary_candidate: text("secondary_candidate"),
    secondary_likelihood: doublePrecision("secondary_likelihood"),
    tertiary_candidate: text("tertiary_candidate"),
    tertiary_likelihood: doublePrecision("tertiary_likelihood"),
    evidence_citations: jsonb("evidence_citations").notNull().default(sql`'[]'::jsonb`),
    system_action: text("system_action"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_failure_classifications_feedback").on(t.feedback_id)],
);

export const patternRecords = pgTable(
  "pattern_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pattern_type: text("pattern_type").notNull(),
    description: text("description").notNull(),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    evidence_count: integer("evidence_count").notNull().default(0),
    first_detected: timestamp("first_detected", { withTimezone: true }).notNull().defaultNow(),
    last_confirmed: timestamp("last_confirmed", { withTimezone: true }).notNull().defaultNow(),
    is_active: boolean("is_active").notNull().default(true),
    actionable: boolean("actionable").notNull().default(false),
    recommendation: text("recommendation"),
    metadata_json: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [index("idx_pattern_records_user_active").on(t.user_id, t.is_active)],
);

export const outcomeValidationRecords = pgTable(
  "outcome_validation_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    order_id: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    feedback_id: uuid("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    proof_quality_score: doublePrecision("proof_quality_score").notNull().default(0),
    proof_type: text("proof_type"),
    missing_criteria: text("missing_criteria").array().notNull().default(sql`ARRAY[]::text[]`),
    false_progress_risk: text("false_progress_risk").notNull().default("NONE"),
    false_progress_score: doublePrecision("false_progress_score").notNull().default(0),
    divergence_factors: jsonb("divergence_factors").notNull().default(sql`'[]'::jsonb`),
    validation_verdict: text("validation_verdict").notNull(),
    proof_requirement_adjusted: boolean("proof_requirement_adjusted").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_outcome_validation_records_feedback").on(t.feedback_id)],
);

// ── GROUP 15 — PROMPT 8 EVENT / HEALTH INFRA ─────────────────────────────────

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    event_id: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    result: jsonb("result"),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_idempotency_records_expires_at").on(t.expires_at),
    index("idx_idempotency_records_key").on(t.key),
  ],
);

export const systemHealthRecords = pgTable(
  "system_health_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    health_score: doublePrecision("health_score").notNull(),
    signal_engine_health: doublePrecision("signal_engine_health").notNull().default(1),
    condition_engine_health: doublePrecision("condition_engine_health").notNull().default(1),
    bhudhi_health: doublePrecision("bhudhi_health").notNull().default(1),
    db_health: doublePrecision("db_health").notNull().default(1),
    worker_health: doublePrecision("worker_health").notNull().default(1),
    eis_health: doublePrecision("eis_health").notNull().default(1),
    critical_alerts: jsonb("critical_alerts").notNull().default(sql`'[]'::jsonb`),
    warnings: jsonb("warnings").notNull().default(sql`'[]'::jsonb`),
    dlq_size: integer("dlq_size").notNull().default(0),
    pending_events: integer("pending_events").notNull().default(0),
    stale_users: integer("stale_users").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_system_health_records_created_at").on(t.created_at)],
);

// ── GROUP 16 — 365 PRINCIPLES (PROMPT 1) ─────────────────────────────────────

export const principles = pgTable(
  "principles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    day_number: integer("day_number").notNull().unique(),
    principle_statement: text("principle_statement").notNull(),
    principle_rules: jsonb("principle_rules").notNull().default(sql`'[]'::jsonb`),
    philosophy: text("philosophy").notNull(),
    tension_points: text("tension_points").notNull(),
    management_volume_source: text("management_volume_source"),
    keywords: jsonb("keywords").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("idx_principles_day_number").on(t.day_number)],
);

export const principleSelections = pgTable(
  "principle_selections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    principle_id: uuid("principle_id")
      .notNull()
      .references(() => principles.id, { onDelete: "cascade" }),
    selected_date: text("selected_date").notNull(),
    selection_reason: text("selection_reason").notNull(),
    signal_state: text("signal_state"),
    execution_blocker: text("execution_blocker"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uniq_principle_selection_user_date").on(t.user_id, t.selected_date),
    index("idx_principle_selections_user_date").on(t.user_id, t.selected_date),
  ],
);

export const principleApplications = pgTable(
  "principle_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    principle_id: uuid("principle_id")
      .notNull()
      .references(() => principles.id, { onDelete: "cascade" }),
    principle_date: text("principle_date").notNull(),
    proof_type: text("proof_type").notNull(),
    proof_content: jsonb("proof_content").notNull().default(sql`'{}'::jsonb`),
    application_description: text("application_description").notNull(),
    linked_order_ids: jsonb("linked_order_ids").notNull().default(sql`'[]'::jsonb`),
    public_visible: boolean("public_visible").notNull().default(true),
    submitted_at: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uniq_principle_application_user_date").on(t.user_id, t.principle_date),
    index("idx_principle_applications_user_date").on(t.user_id, t.principle_date),
  ],
);

export const principleStreaks = pgTable("principle_streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  current_streak: integer("current_streak").notNull().default(0),
  best_streak: integer("best_streak").notNull().default(0),
  last_applied_date: text("last_applied_date"),
  streak_frozen_month: text("streak_frozen_month"),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const principleProofUploads = pgTable(
  "principle_proof_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    application_id: uuid("application_id")
      .notNull()
      .references(() => principleApplications.id, { onDelete: "cascade" }),
    file_url: text("file_url"),
    file_type: text("file_type"),
    file_size: integer("file_size"),
    duration_seconds: integer("duration_seconds"),
    uploaded_at: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_principle_proof_uploads_application").on(t.application_id)],
);

export const contentGuidance = pgTable(
  "content_guidance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    principle_id: uuid("principle_id")
      .notNull()
      .references(() => principles.id, { onDelete: "cascade" }),
    guidance_date: text("guidance_date").notNull(),
    recommended_platforms: jsonb("recommended_platforms").notNull().default(sql`'[]'::jsonb`),
    recommended_format: text("recommended_format").notNull(),
    content_angle: text("content_angle").notNull(),
    trending_topics: jsonb("trending_topics").notNull().default(sql`'[]'::jsonb`),
    platform_trends: jsonb("platform_trends").notNull().default(sql`'{}'::jsonb`),
    research_prompts: text("research_prompts"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_content_guidance_user_date").on(t.user_id, t.guidance_date)],
);

export const userSocialAccounts = pgTable(
  "user_social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    account_id: text("account_id"),
    access_token_encrypted: text("access_token_encrypted"),
    refresh_token_encrypted: text("refresh_token_encrypted"),
    connected_at: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_user_social_platform").on(t.user_id, t.platform)],
);

export const publishedContent = pgTable("published_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  principle_id: uuid("principle_id").references(() => principles.id, { onDelete: "set null" }),
  content_date: text("content_date").notNull(),
  platforms_posted: jsonb("platforms_posted").notNull().default(sql`'[]'::jsonb`),
  content_text: text("content_text").notNull(),
  content_url: text("content_url"),
  engagement: jsonb("engagement").notNull().default(sql`'{}'::jsonb`),
  published_at: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  synced_engagement_at: timestamp("synced_engagement_at", { withTimezone: true }),
});

export const userPrincipleProfiles = pgTable(
  "user_principle_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull().unique(),
    bio: text("bio"),
    profile_public: boolean("profile_public").notNull().default(false),
    profile_url_slug: text("profile_url_slug").notNull().unique(),
    privacy_setting: text("privacy_setting").notNull().default("private"),
    show_execution_level: boolean("show_execution_level").notNull().default(true),
    show_avatar: boolean("show_avatar").notNull().default(true),
    show_achievements: boolean("show_achievements").notNull().default(true),
    show_principle_record: boolean("show_principle_record").notNull().default(true),
    show_streak: boolean("show_streak").notNull().default(true),
    show_activity: boolean("show_activity").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("idx_user_principle_profiles_slug").on(t.profile_url_slug)],
);

export const dailyPrincipleRecords = pgTable(
  "daily_principle_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    principle_date: text("principle_date").notNull(),
    principle_id: uuid("principle_id")
      .notNull()
      .references(() => principles.id, { onDelete: "cascade" }),
    application_id: uuid("application_id").references(() => principleApplications.id, {
      onDelete: "set null",
    }),
    published_content_ids: jsonb("published_content_ids").notNull().default(sql`'[]'::jsonb`),
    engagement_summary: jsonb("engagement_summary").notNull().default(sql`'{}'::jsonb`),
    public_visible: boolean("public_visible").notNull().default(true),
    reflection: text("reflection"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uniq_daily_principle_record_user_date").on(t.user_id, t.principle_date),
    index("idx_daily_principle_records_user_date").on(t.user_id, t.principle_date),
  ],
);

// ── GROUP 17 — ERECTOR ACADEMY (PROMPT 2) ────────────────────────────────────

export const academyCourses = pgTable(
  "academy_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    difficulty_level: text("difficulty_level").notNull().default("beginner"),
    estimated_duration_hours: integer("estimated_duration_hours").notNull().default(10),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const academyChapters = pgTable(
  "academy_chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    course_id: uuid("course_id")
      .notNull()
      .references(() => academyCourses.id, { onDelete: "cascade" }),
    chapter_number: integer("chapter_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    learning_objectives: jsonb("learning_objectives").notNull().default(sql`'[]'::jsonb`),
    estimated_duration_minutes: integer("estimated_duration_minutes").notNull().default(30),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_academy_chapter_course_num").on(t.course_id, t.chapter_number)],
);

export const academyLessons = pgTable(
  "academy_lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chapter_id: uuid("chapter_id")
      .notNull()
      .references(() => academyChapters.id, { onDelete: "cascade" }),
    lesson_number: integer("lesson_number").notNull(),
    title: text("title").notNull(),
    content_type: text("content_type").notNull().default("text"),
    content_body: text("content_body").notNull(),
    key_concepts: jsonb("key_concepts").notNull().default(sql`'[]'::jsonb`),
    reading_time_minutes: integer("reading_time_minutes").notNull().default(15),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_academy_lesson_chapter_num").on(t.chapter_id, t.lesson_number)],
);

export const academyPracticeItems = pgTable(
  "academy_practice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lesson_id: uuid("lesson_id")
      .notNull()
      .references(() => academyLessons.id, { onDelete: "cascade" }),
    item_type: text("item_type").notNull().default("quiz"),
    difficulty: integer("difficulty").notNull().default(2),
    question_text: text("question_text").notNull(),
    answer_options: jsonb("answer_options"),
    correct_answer: text("correct_answer").notNull(),
    explanation: text("explanation").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_academy_practice_items_lesson").on(t.lesson_id)],
);

export const academyStudentEnrollments = pgTable(
  "academy_student_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    course_id: uuid("course_id")
      .notNull()
      .references(() => academyCourses.id, { onDelete: "cascade" }),
    enrolled_at: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    status: text("status").notNull().default("enrolled"),
    progress_percent: integer("progress_percent").notNull().default(0),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_academy_enrollment_user_course").on(t.user_id, t.course_id)],
);

export const academyStudentLearningProfiles = pgTable("academy_student_learning_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  learning_style: text("learning_style").notNull().default("reading"),
  pace: text("pace").notNull().default("normal"),
  preferred_formats: jsonb("preferred_formats").notNull().default(sql`'["text"]'::jsonb`),
  comprehension_speed: doublePrecision("comprehension_speed").notNull().default(1),
  retention_rate: doublePrecision("retention_rate").notNull().default(0.7),
  common_mistakes: jsonb("common_mistakes").notNull().default(sql`'[]'::jsonb`),
  strengths: jsonb("strengths").notNull().default(sql`'[]'::jsonb`),
  weaknesses: jsonb("weaknesses").notNull().default(sql`'[]'::jsonb`),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const academyLessonAttempts = pgTable("academy_lesson_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lesson_id: uuid("lesson_id")
    .notNull()
    .references(() => academyLessons.id, { onDelete: "cascade" }),
  started_at: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  time_spent_seconds: integer("time_spent_seconds"),
  score: doublePrecision("score"),
  passed: boolean("passed").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyPracticeAttempts = pgTable("academy_practice_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  practice_item_id: uuid("practice_item_id")
    .notNull()
    .references(() => academyPracticeItems.id, { onDelete: "cascade" }),
  attempted_at: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  user_answer: text("user_answer").notNull(),
  correct: boolean("correct").notNull(),
  time_taken_seconds: integer("time_taken_seconds"),
  is_retry: boolean("is_retry").notNull().default(false),
});

export const academyConceptMastery = pgTable(
  "academy_concept_mastery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    concept_id: text("concept_id").notNull(),
    mastery_level: doublePrecision("mastery_level").notNull().default(0),
    first_attempted_at: timestamp("first_attempted_at", { withTimezone: true }).notNull().defaultNow(),
    last_attempted_at: timestamp("last_attempted_at", { withTimezone: true }).notNull().defaultNow(),
    total_attempts: integer("total_attempts").notNull().default(0),
    successful_attempts: integer("successful_attempts").notNull().default(0),
    confidence: doublePrecision("confidence").notNull().default(0.5),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_academy_concept_mastery_user_concept").on(t.user_id, t.concept_id)],
);

export const academyLearningPatterns = pgTable("academy_learning_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pattern_type: text("pattern_type").notNull(),
  pattern_description: text("pattern_description").notNull(),
  frequency: integer("frequency").notNull().default(1),
  detected_at: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  actionable_insight: text("actionable_insight"),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const academyRetentionData = pgTable(
  "academy_retention_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lesson_id: uuid("lesson_id")
      .notNull()
      .references(() => academyLessons.id, { onDelete: "cascade" }),
    learned_at: timestamp("learned_at", { withTimezone: true }).notNull().defaultNow(),
    recalled_correctly: integer("recalled_correctly").notNull().default(0),
    recalled_incorrectly: integer("recalled_incorrectly").notNull().default(0),
    retention_percent: doublePrecision("retention_percent").notNull().default(0),
    forgetting_curve: doublePrecision("forgetting_curve"),
    next_review_date: text("next_review_date"),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_academy_retention_user_lesson").on(t.user_id, t.lesson_id)],
);

export const academyLearningGoals = pgTable("academy_learning_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  goal_title: text("goal_title").notNull(),
  target_skill: text("target_skill").notNull(),
  target_mastery_level: integer("target_mastery_level").notNull().default(80),
  deadline: text("deadline"),
  aligned_with_blueprint_id: uuid("aligned_with_blueprint_id").references(() => blueprints.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyStudySchedules = pgTable("academy_study_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  learning_goal_id: uuid("learning_goal_id")
    .notNull()
    .references(() => academyLearningGoals.id, { onDelete: "cascade" }),
  schedule_type: text("schedule_type").notNull().default("weekly"),
  sessions_per_week: integer("sessions_per_week").notNull().default(3),
  minutes_per_session: integer("minutes_per_session").notNull().default(45),
  start_date: text("start_date"),
  end_date: text("end_date"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyRoadmapSteps = pgTable(
  "academy_roadmap_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    learning_goal_id: uuid("learning_goal_id")
      .notNull()
      .references(() => academyLearningGoals.id, { onDelete: "cascade" }),
    step_number: integer("step_number").notNull(),
    course_id: uuid("course_id").references(() => academyCourses.id, { onDelete: "set null" }),
    estimated_duration_days: integer("estimated_duration_days").notNull().default(7),
    prerequisite_step_ids: jsonb("prerequisite_step_ids").notNull().default(sql`'[]'::jsonb`),
    status: text("status").notNull().default("not-started"),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("uniq_academy_roadmap_goal_step").on(t.learning_goal_id, t.step_number)],
);

export const academyGeneratedContent = pgTable("academy_generated_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content_type: text("content_type").notNull(),
  topic: text("topic").notNull(),
  generated_content: text("generated_content").notNull(),
  generated_at: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyStudySessions = pgTable(
  "academy_study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    learning_goal_id: uuid("learning_goal_id").references(() => academyLearningGoals.id, {
      onDelete: "set null",
    }),
    schedule_id: uuid("schedule_id").references(() => academyStudySchedules.id, {
      onDelete: "set null",
    }),
    session_date: text("session_date").notNull(),
    start_time: text("start_time").notNull(),
    duration_minutes: integer("duration_minutes").notNull().default(45),
    synced_to_calendar: boolean("synced_to_calendar").notNull().default(false),
    calendar_block_id: text("calendar_block_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_academy_study_sessions_user_date").on(t.user_id, t.session_date)],
);

// ── GROUP 18 — TORGIMA CALENDAR (PROMPT 3) ───────────────────────────────────

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    source_id: uuid("source_id"),
    source_type: text("source_type").notNull(),
    start_time: timestamp("start_time", { withTimezone: true }).notNull(),
    end_time: timestamp("end_time", { withTimezone: true }).notNull(),
    duration_minutes: integer("duration_minutes").notNull(),
    priority: integer("priority").notNull().default(3),
    is_all_day: boolean("is_all_day").notNull().default(false),
    location: text("location"),
    location_coordinates: jsonb("location_coordinates"),
    color: text("color").notNull().default("#3b82f6"),
    status: text("status").notNull().default("scheduled"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uniq_calendar_event_user_source").on(t.user_id, t.source_id, t.source_type),
    index("idx_calendar_events_user_start").on(t.user_id, t.start_time),
    index("idx_calendar_events_user_status").on(t.user_id, t.status),
  ],
);

export const calendarNotifications = pgTable(
  "calendar_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    event_id: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notification_type: text("notification_type").notNull().default("in-app"),
    trigger_minutes_before: integer("trigger_minutes_before").notNull(),
    scheduled_send_at: timestamp("scheduled_send_at", { withTimezone: true }).notNull(),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    read_at: timestamp("read_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_calendar_notifications_due").on(t.scheduled_send_at)],
);

export const calendarConflicts = pgTable(
  "calendar_conflicts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event_1_id: uuid("event_1_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    event_2_id: uuid("event_2_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    conflict_type: text("conflict_type").notNull(),
    detected_at: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    resolution_action: text("resolution_action"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_calendar_conflicts_user").on(t.user_id)],
);

export const calendarViewsPreferences = pgTable("calendar_views_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  default_view: text("default_view").notNull().default("calendar"),
  filters: jsonb("filters").notNull().default(sql`'{}'::jsonb`),
  color_coding: text("color_coding").notNull().default("by-type"),
  time_zone: text("time_zone").notNull().default("UTC"),
  week_start_day: integer("week_start_day").notNull().default(1),
  show_weekends: boolean("show_weekends").notNull().default(true),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const calendarTimeBlocks = pgTable(
  "calendar_time_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    block_type: text("block_type").notNull(),
    start_time: timestamp("start_time", { withTimezone: true }).notNull(),
    end_time: timestamp("end_time", { withTimezone: true }).notNull(),
    recurring: boolean("recurring").notNull().default(false),
    recurrence_pattern: text("recurrence_pattern"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_calendar_time_blocks_user").on(t.user_id, t.start_time)],
);

// ── GROUP 19 — CHAT & NOTIFICATIONS (PROMPT 4) ───────────────────────────────

export const personalMessages = pgTable(
  "personal_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message_type: text("message_type").notNull().default("text"),
    content: text("content"),
    voice_url: text("voice_url"),
    voice_duration_seconds: integer("voice_duration_seconds"),
    voice_transcription: text("voice_transcription"),
    attachments: jsonb("attachments").notNull().default(sql`'[]'::jsonb`),
    linked_order_id: uuid("linked_order_id").references(() => orders.id, { onDelete: "set null" }),
    linked_principle_id: uuid("linked_principle_id"),
    sentiment: text("sentiment"),
    tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
    is_blocker: boolean("is_blocker").notNull().default(false),
    blocker_type: text("blocker_type"),
    blocker_severity: integer("blocker_severity"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("idx_personal_messages_user_created").on(t.user_id, t.created_at)],
);

export const messageAttachments = pgTable("message_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  message_id: uuid("message_id")
    .notNull()
    .references(() => personalMessages.id, { onDelete: "cascade" }),
  file_url: text("file_url").notNull(),
  file_name: text("file_name").notNull(),
  file_type: text("file_type"),
  file_size: integer("file_size"),
  uploaded_at: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageSearchIndex = pgTable(
  "message_search_index",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message_id: uuid("message_id")
      .notNull()
      .references(() => personalMessages.id, { onDelete: "cascade" }),
    searchable_text: text("searchable_text").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_message_search_user").on(t.user_id)],
);

export const blockerLogs = pgTable(
  "blocker_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message_id: uuid("message_id")
      .notNull()
      .references(() => personalMessages.id, { onDelete: "cascade" }),
    blocker_type: text("blocker_type").notNull(),
    severity: integer("severity").notNull().default(3),
    description: text("description").notNull(),
    related_order_id: uuid("related_order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"),
    resolution_date: text("resolution_date"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_blocker_logs_user_status").on(t.user_id, t.status)],
);

export const chatVoiceMessages = pgTable("chat_voice_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  message_id: uuid("message_id")
    .notNull()
    .references(() => personalMessages.id, { onDelete: "cascade" }),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  audio_file_url: text("audio_file_url").notNull(),
  duration_seconds: integer("duration_seconds").notNull(),
  transcription: text("transcription"),
  transcription_confidence: doublePrecision("transcription_confidence"),
  transcribed_at: timestamp("transcribed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const statusSnapshots = pgTable("status_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  energy: integer("energy").notNull(),
  clarity: integer("clarity").notNull(),
  momentum: integer("momentum").notNull(),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userNotificationChannels = pgTable(
  "user_notification_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel_type: text("channel_type").notNull(),
    is_connected: boolean("is_connected").notNull().default(false),
    oauth_token_encrypted: text("oauth_token_encrypted"),
    oauth_refresh_token_encrypted: text("oauth_refresh_token_encrypted"),
    channel_identifier: text("channel_identifier"),
    connected_at: timestamp("connected_at", { withTimezone: true }),
    disconnected_at: timestamp("disconnected_at", { withTimezone: true }),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_user_notification_channel").on(t.user_id, t.channel_type)],
);

export const channelNotificationPreferences = pgTable(
  "channel_notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel_type: text("channel_type").notNull(),
    notification_type: text("notification_type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull().default(3),
    delivery_time_window_start: text("delivery_time_window_start"),
    delivery_time_window_end: text("delivery_time_window_end"),
    batch_frequency: text("batch_frequency").notNull().default("immediate"),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uniq_channel_notification_pref").on(
      t.user_id,
      t.channel_type,
      t.notification_type,
    ),
  ],
);

export const notificationDeliveryQueue = pgTable(
  "notification_delivery_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notification_type: text("notification_type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    priority: integer("priority").notNull().default(3),
    channels_to_send: jsonb("channels_to_send").notNull().default(sql`'[]'::jsonb`),
    scheduled_for: timestamp("scheduled_for", { withTimezone: true }).notNull().defaultNow(),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    failed_at: timestamp("failed_at", { withTimezone: true }),
    failure_reason: text("failure_reason"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_notification_delivery_queue_due").on(t.scheduled_for)],
);

export const notificationDeliveryHistory = pgTable("notification_delivery_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  queue_id: uuid("queue_id").references(() => notificationDeliveryQueue.id, {
    onDelete: "set null",
  }),
  channel_type: text("channel_type").notNull(),
  status: text("status").notNull(),
  delivery_timestamp: timestamp("delivery_timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  read_at: timestamp("read_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const doNotDisturbSchedules = pgTable("do_not_disturb_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  start_time: text("start_time").notNull().default("22:00"),
  end_time: text("end_time").notNull().default("07:00"),
  days_of_week: jsonb("days_of_week").notNull().default(sql`'[0,1,2,3,4,5,6]'::jsonb`),
  timezone: text("timezone").notNull().default("UTC"),
  enabled: boolean("enabled").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const inAppNotifications = pgTable(
  "in_app_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    notification_type: text("notification_type").notNull(),
    priority: integer("priority").notNull().default(3),
    read_at: timestamp("read_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_in_app_notifications_user").on(t.user_id)],
);

// ─── GROUP 20: Gamification (PROMPT 5) ───────────────────────────────────────

export const userGamificationProfile = pgTable(
  "user_gamification_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    current_level: integer("current_level").notNull().default(1),
    total_xp: integer("total_xp").notNull().default(0),
    xp_to_next_level: integer("xp_to_next_level").notNull().default(100),
    avatar_id: uuid("avatar_id"),
    avatar_customization: jsonb("avatar_customization").notNull().default(sql`'{}'::jsonb`),
    total_achievements: integer("total_achievements").notNull().default(0),
    total_rewards_earned: integer("total_rewards_earned").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
);

export const xpLedger = pgTable(
  "xp_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    xp_amount: integer("xp_amount").notNull(),
    xp_source: text("xp_source").notNull(),
    source_id: text("source_id"),
    multiplier_applied: doublePrecision("multiplier_applied").notNull().default(1),
    earned_at: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_xp_ledger_user_earned").on(t.user_id, t.earned_at)],
);

export const userLevels = pgTable(
  "user_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    level_number: integer("level_number").notNull(),
    xp_required_total: integer("xp_required_total").notNull(),
    milestone_description: text("milestone_description"),
    reached_at: timestamp("reached_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_user_level").on(t.user_id, t.level_number)],
);

export const userStreaks = pgTable(
  "user_streaks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    streak_type: text("streak_type").notNull(),
    current_count: integer("current_count").notNull().default(0),
    best_count: integer("best_count").notNull().default(0),
    last_activity_date: text("last_activity_date"),
    frozen_count: integer("frozen_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_user_streak_type").on(t.user_id, t.streak_type)],
);

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  achievement_id: text("achievement_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  icon_url: text("icon_url"),
  trigger_condition: jsonb("trigger_condition").notNull().default(sql`'{}'::jsonb`),
  xp_reward: integer("xp_reward").notNull().default(0),
  rarity: text("rarity").notNull().default("common"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievement_id: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    unlocked_at: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    display_on_profile: boolean("display_on_profile").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_user_achievement").on(t.user_id, t.achievement_id)],
);

export const avatarTemplates = pgTable("avatar_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  avatar_name: text("avatar_name").notNull(),
  base_asset_url: text("base_asset_url"),
  customization_options: jsonb("customization_options").notNull().default(sql`'{}'::jsonb`),
  evolution_level: integer("evolution_level").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userAvatar = pgTable("user_avatar", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  current_avatar_template_id: uuid("current_avatar_template_id").references(
    () => avatarTemplates.id,
    { onDelete: "set null" },
  ),
  color: text("color").notNull().default("violet"),
  accessories: jsonb("accessories").notNull().default(sql`'[]'::jsonb`),
  pose: text("pose").notNull().default("standing"),
  customized_at: timestamp("customized_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rewards = pgTable("rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  reward_id: text("reward_id").notNull().unique(),
  reward_type: text("reward_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  unlock_requirement: text("unlock_requirement"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRewards = pgTable(
  "user_rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reward_id: uuid("reward_id")
      .notNull()
      .references(() => rewards.id, { onDelete: "cascade" }),
    earned_at: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
    display_on_profile: boolean("display_on_profile").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_user_reward").on(t.user_id, t.reward_id)],
);

export const levelDefinitions = pgTable("level_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: integer("level").notNull().unique(),
  xp_required_total: integer("xp_required_total").notNull(),
  milestone_title: text("milestone_title"),
  milestone_description: text("milestone_description"),
  avatar_evolution_unlocked: boolean("avatar_evolution_unlocked").notNull().default(false),
  new_cosmetics_available: jsonb("new_cosmetics_available").notNull().default(sql`'[]'::jsonb`),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── GROUP 21: Mobile app (PROMPT 6) ───────────────────────────────────────────

export const mobileDeviceTokens = pgTable(
  "mobile_device_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    push_token: text("push_token").notNull(),
    platform: text("platform").notNull(),
    device_id: text("device_id"),
    app_version: text("app_version"),
    is_active: boolean("is_active").notNull().default(true),
    last_seen_at: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_mobile_device_token").on(t.user_id, t.push_token)],
);

export const mobileHealthMetrics = pgTable(
  "mobile_health_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric_date: text("metric_date").notNull(),
    steps: integer("steps"),
    active_minutes: integer("active_minutes"),
    calories_burned: integer("calories_burned"),
    heart_rate_avg: integer("heart_rate_avg"),
    sleep_hours: doublePrecision("sleep_hours"),
    source: text("source").notNull().default("apple-health"),
    raw_payload: jsonb("raw_payload").notNull().default(sql`'{}'::jsonb`),
    synced_at: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_mobile_health_day").on(t.user_id, t.metric_date, t.source)],
);

export const mobileWearableConnections = pgTable(
  "mobile_wearable_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    oauth_token_encrypted: text("oauth_token_encrypted"),
    is_connected: boolean("is_connected").notNull().default(false),
    connected_at: timestamp("connected_at", { withTimezone: true }),
    disconnected_at: timestamp("disconnected_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_mobile_wearable").on(t.user_id, t.provider)],
);

export const mobileSyncLog = pgTable(
  "mobile_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    client_action_id: text("client_action_id").notNull(),
    resource: text("resource").notNull(),
    action_type: text("action_type").notNull(),
    status: text("status").notNull().default("applied"),
    error_message: text("error_message"),
    applied_at: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_mobile_sync_action").on(t.user_id, t.client_action_id)],
);
