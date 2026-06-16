/**
 * Erector product tiers, intake sessions, handoff engine, and Ultimate intelligence tables.
 * Schema addendum — adds only; never modifies DOC 02 base tables beyond nullable column additions.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { blueprints, users } from "./tables";

export const erectorFreeValidations = pgTable(
  "erector_free_validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fingerprint: text("fingerprint").notNull(),
    ip_address: text("ip_address"),
    industry: text("industry").notNull(),
    location: text("location").notNull(),
    budget_range: text("budget_range").notNull(),
    timeline: text("timeline").notNull(),
    additional_context: text("additional_context"),
    report_json: jsonb("report_json").notNull().default(sql`'{}'::jsonb`),
    validation_score: integer("validation_score"),
    verdict: text("verdict"),
    converted_to: text("converted_to"),
    converted_at: timestamp("converted_at", { withTimezone: true }),
    handoff_token_id: uuid("handoff_token_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_erector_free_fingerprint").on(t.fingerprint),
    index("idx_erector_free_created_at").on(t.created_at),
  ],
);

export const erectorPaidValidations = pgTable(
  "erector_paid_validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tier: text("tier").notNull(),
    intake_json: jsonb("intake_json").notNull().default(sql`'{}'::jsonb`),
    project_name: text("project_name"),
    verdict: text("verdict"),
    selected_path: text("selected_path"),
    goal_structured: jsonb("goal_structured").default(sql`'{}'::jsonb`),
    purpose_structured: jsonb("purpose_structured").default(sql`'{}'::jsonb`),
    industry: text("industry"),
    location: text("location"),
    business_type: text("business_type"),
    revenue_model: text("revenue_model"),
    budget_range: text("budget_range"),
    hours_per_week: integer("hours_per_week"),
    team_size: integer("team_size"),
    skills_present: text("skills_present").array().default(sql`ARRAY[]::text[]`),
    skills_missing: text("skills_missing").array().default(sql`ARRAY[]::text[]`),
    timeline_launch: text("timeline_launch"),
    timeline_customers: text("timeline_customers"),
    timeline_final: text("timeline_final"),
    success_30_days: text("success_30_days"),
    success_90_days: text("success_90_days"),
    success_12_months: text("success_12_months"),
    risk_flags: text("risk_flags").array().default(sql`ARRAY[]::text[]`),
    policy_rules: text("policy_rules").array().default(sql`ARRAY[]::text[]`),
    policy_dont: text("policy_dont").array().default(sql`ARRAY[]::text[]`),
    winning_conditions: text("winning_conditions").array().default(sql`ARRAY[]::text[]`),
    failure_conditions: text("failure_conditions").array().default(sql`ARRAY[]::text[]`),
    validation_score: integer("validation_score"),
    probability_proceed: integer("probability_proceed"),
    archetype: text("archetype"),
    report_json: jsonb("report_json").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("pending"),
    blueprint_created: boolean("blueprint_created").default(false),
    blueprint_id: uuid("blueprint_id"),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_erector_paid_validations_user_id").on(t.user_id)],
);

export const erectorIntakeSessions = pgTable(
  "erector_intake_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    tier: text("tier").notNull(),
    current_section: integer("current_section").notNull().default(1),
    sections_completed: integer("sections_completed").array().default(sql`ARRAY[]::integer[]`),
    section_1_data: jsonb("section_1_data").default(sql`'{}'::jsonb`),
    section_2_data: jsonb("section_2_data").default(sql`'{}'::jsonb`),
    section_3_data: jsonb("section_3_data").default(sql`'{}'::jsonb`),
    section_4_data: jsonb("section_4_data").default(sql`'{}'::jsonb`),
    section_5_data: jsonb("section_5_data").default(sql`'{}'::jsonb`),
    section_6_data: jsonb("section_6_data").default(sql`'{}'::jsonb`),
    section_7_data: jsonb("section_7_data").default(sql`'{}'::jsonb`),
    section_8_data: jsonb("section_8_data").default(sql`'{}'::jsonb`),
    prefilled_from_handoff: boolean("prefilled_from_handoff").default(false),
    handoff_token_id: uuid("handoff_token_id"),
    normalized_payload: jsonb("normalized_payload").notNull().default(sql`'{}'::jsonb`),
    missing_fields: text("missing_fields").array().notNull().default(sql`ARRAY[]::text[]`),
    ambiguity_flags: text("ambiguity_flags").array().notNull().default(sql`ARRAY[]::text[]`),
    contradiction_flags: text("contradiction_flags").array().notNull().default(sql`ARRAY[]::text[]`),
    validation_ready: boolean("validation_ready").notNull().default(false),
    status: text("status").notNull().default("in_progress"),
    validation_id: uuid("validation_id"),
    started_at: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    last_saved_at: timestamp("last_saved_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_erector_intake_sessions_user_id").on(t.user_id),
    index("idx_intake_sessions_status").on(t.status),
  ],
);

export const handoffTokens = pgTable(
  "handoff_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source_tier: text("source_tier").notNull(),
    target_tier: text("target_tier").notNull(),
    source_validation_id: uuid("source_validation_id"),
    user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    token_hash: text("token_hash").notNull().unique(),
    data_json: jsonb("data_json").notNull().default(sql`'{}'::jsonb`),
    consumed: boolean("consumed").notNull().default(false),
    consumed_at: timestamp("consumed_at", { withTimezone: true }),
    consumed_by_user_id: uuid("consumed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_handoff_tokens_token_hash").on(t.token_hash),
    index("idx_handoff_tokens_expires_at").on(t.expires_at),
  ],
);

export const simulationResults = pgTable(
  "simulation_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    validation_id: uuid("validation_id").notNull(),
    blueprint_id: uuid("blueprint_id"),
    archetype: text("archetype").notNull(),
    scenario_best_description: text("scenario_best_description"),
    scenario_best_probability: integer("scenario_best_probability"),
    scenario_best_timeline_adj: text("scenario_best_timeline_adj"),
    scenario_best_risks: text("scenario_best_risks").array().default(sql`ARRAY[]::text[]`),
    scenario_best_triggers: text("scenario_best_triggers").array().default(sql`ARRAY[]::text[]`),
    scenario_base_description: text("scenario_base_description"),
    scenario_base_probability: integer("scenario_base_probability"),
    scenario_base_timeline_adj: text("scenario_base_timeline_adj"),
    scenario_base_risks: text("scenario_base_risks").array().default(sql`ARRAY[]::text[]`),
    scenario_base_triggers: text("scenario_base_triggers").array().default(sql`ARRAY[]::text[]`),
    scenario_downside_description: text("scenario_downside_description"),
    scenario_downside_probability: integer("scenario_downside_probability"),
    scenario_downside_timeline_adj: text("scenario_downside_timeline_adj"),
    scenario_downside_risks: text("scenario_downside_risks").array().default(sql`ARRAY[]::text[]`),
    scenario_downside_triggers: text("scenario_downside_triggers").array().default(sql`ARRAY[]::text[]`),
    framework_verdicts_json: jsonb("framework_verdicts_json").default(sql`'{}'::jsonb`),
    veto_active: boolean("veto_active").default(false),
    veto_frameworks: text("veto_frameworks").array().default(sql`ARRAY[]::text[]`),
    veto_reasons: text("veto_reasons").array().default(sql`ARRAY[]::text[]`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_simulation_results_user_id").on(t.user_id),
    index("idx_simulation_results_validation_id").on(t.validation_id),
  ],
);

export const goalIntelligence = pgTable(
  "goal_intelligence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    current_goal: text("current_goal").notNull(),
    expected_goal: text("expected_goal"),
    future_goal: text("future_goal"),
    divergence_detected: boolean("divergence_detected").default(false),
    divergence_score: integer("divergence_score").default(0),
    divergence_reason: text("divergence_reason"),
    alert_active: boolean("alert_active").default(false),
    alert_type: text("alert_type"),
    alert_message: text("alert_message"),
    last_evaluated_at: timestamp("last_evaluated_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_goal_intelligence_user_id").on(t.user_id),
    index("idx_goal_intelligence_blueprint_id").on(t.blueprint_id),
  ],
);

/** Ultimate Plan 14-day predictive warnings — distinct from legacy `prediction_logs` agent table. */
export const predictionLog = pgTable(
  "prediction_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    warning_type: text("warning_type").notNull(),
    customer_label: text("customer_label").notNull(),
    trigger_condition: text("trigger_condition").notNull(),
    predicted_days_until_crisis: integer("predicted_days_until_crisis"),
    confidence: integer("confidence").default(0),
    action_generated: boolean("action_generated").default(false),
    action_order_id: uuid("action_order_id"),
    status: text("status").notNull().default("active"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    resolution_type: text("resolution_type"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_prediction_log_user_id").on(t.user_id),
    index("idx_prediction_log_blueprint_id").on(t.blueprint_id),
    index("idx_prediction_log_status").on(t.status),
  ],
);
