/**
 * ERECTOR SCHEMA 1 — Core Runtime tables (DOC: ERECTOR_SCHEMA_1_Core_Runtime).
 * Foundation schema for validation, verdict, archetype, simulation, and launch contracts.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { blueprints, users } from "./tables";
import { erectorIntakeSessions } from "./erectorTables";

/**
 * Prompt 5 — Erector Reality Packages
 * Structured baseline payload used by Blueprint generation and task enforcement.
 */
export const erectorRealityPackages = pgTable(
  "erector_reality_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    validation_run_id: uuid("validation_run_id"),
    intake_session_id: uuid("intake_session_id"),
    tier: text("tier"),
    model_version: text("model_version").notNull().default("v0.1"),
    package_json: jsonb("package_json").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_erector_reality_packages_blueprint").on(t.blueprint_id),
    index("idx_erector_reality_packages_user").on(t.user_id),
  ],
);

export const erectorUserRealityProfiles = pgTable(
  "erector_user_reality_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    intake_session_id: uuid("intake_session_id")
      .notNull()
      .references(() => erectorIntakeSessions.id),
    structured_goal: text("structured_goal").notNull(),
    goal_measurable_outcome: text("goal_measurable_outcome"),
    structured_purpose: jsonb("structured_purpose").notNull().default(sql`'{}'::jsonb`),
    industry: text("industry"),
    location: text("location"),
    market_scope: text("market_scope"),
    operating_context: text("operating_context"),
    revenue_model: text("revenue_model"),
    price_range: text("price_range"),
    business_type: text("business_type"),
    budget_range: text("budget_range"),
    budget_usd_estimate: integer("budget_usd_estimate"),
    hours_per_week: integer("hours_per_week"),
    team_size: integer("team_size").notNull().default(1),
    skills_present: text("skills_present").array().notNull().default(sql`ARRAY[]::text[]`),
    skills_missing: text("skills_missing").array().notNull().default(sql`ARRAY[]::text[]`),
    timeline_launch: text("timeline_launch"),
    timeline_customers: text("timeline_customers"),
    timeline_final: text("timeline_final"),
    known_blockers: text("known_blockers").array().notNull().default(sql`ARRAY[]::text[]`),
    prior_attempts: jsonb("prior_attempts").notNull().default(sql`'[]'::jsonb`),
    regulatory_flags: text("regulatory_flags").array().notNull().default(sql`ARRAY[]::text[]`),
    success_30_days: text("success_30_days"),
    success_90_days: text("success_90_days"),
    success_12_months: text("success_12_months"),
    payment_infrastructure: text("payment_infrastructure"),
    market_maturity: text("market_maturity"),
    internet_reliability: text("internet_reliability"),
    profile_model_version: text("profile_model_version").notNull().default("v0.1"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_reality_profiles_user").on(t.user_id)],
);

export const erectorVerdictRules = pgTable(
  "erector_verdict_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rule_id: text("rule_id").notNull().unique(),
    rule_name: text("rule_name").notNull(),
    rule_version: text("rule_version").notNull().default("v0.1"),
    applies_to_engine: text("applies_to_engine").notNull(),
    dimension: text("dimension").notNull(),
    condition_description: text("condition_description").notNull(),
    threshold_type: text("threshold_type").notNull(),
    threshold_value: jsonb("threshold_value").notNull().default(sql`'{}'::jsonb`),
    tier_applicability: text("tier_applicability")
      .array()
      .notNull()
      .default(sql`ARRAY['starter','growth','ultimate']::text[]`),
    severity: text("severity").notNull(),
    verdict_effect: text("verdict_effect").notNull(),
    correction_required: text("correction_required"),
    revalidation_required: boolean("revalidation_required").notNull().default(false),
    user_visible_reason: text("user_visible_reason").notNull(),
    bypass_allowed: boolean("bypass_allowed").notNull().default(false),
    active: boolean("active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_verdict_rules_engine").on(t.applies_to_engine),
    index("idx_verdict_rules_active").on(t.active),
  ],
);

export const erectorValidationRuns = pgTable(
  "erector_validation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    intake_session_id: uuid("intake_session_id").references(() => erectorIntakeSessions.id),
    reality_profile_id: uuid("reality_profile_id").references(() => erectorUserRealityProfiles.id),
    run_number: integer("run_number").notNull().default(1),
    tier: text("tier").notNull(),
    market_viability_score: integer("market_viability_score"),
    demand_proof_score: integer("demand_proof_score"),
    feasibility_score: integer("feasibility_score"),
    context_readiness_score: integer("context_readiness_score"),
    contradiction_score: integer("contradiction_score").notNull().default(0),
    evidence_quality_score: integer("evidence_quality_score"),
    confidence_score: integer("confidence_score"),
    risk_score: integer("risk_score"),
    overall_validation_score: integer("overall_validation_score"),
    demand_proof_class: integer("demand_proof_class").notNull().default(0),
    feasibility_rating: text("feasibility_rating"),
    path_current: jsonb("path_current").notNull().default(sql`'{}'::jsonb`),
    path_adjusted: jsonb("path_adjusted").notNull().default(sql`'{}'::jsonb`),
    path_alternative: jsonb("path_alternative").notNull().default(sql`'{}'::jsonb`),
    selected_path: text("selected_path"),
    verdict: text("verdict"),
    verdict_confidence: text("verdict_confidence"),
    rules_applied: text("rules_applied").array().notNull().default(sql`ARRAY[]::text[]`),
    hard_blockers: text("hard_blockers").array().notNull().default(sql`ARRAY[]::text[]`),
    soft_warnings: text("soft_warnings").array().notNull().default(sql`ARRAY[]::text[]`),
    risk_flags: text("risk_flags").array().notNull().default(sql`ARRAY[]::text[]`),
    requires_correction: boolean("requires_correction").notNull().default(false),
    correction_fields: text("correction_fields").array().notNull().default(sql`ARRAY[]::text[]`),
    validation_model_version: text("validation_model_version").notNull().default("v0.1"),
    status: text("status").notNull().default("pending"),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // NOTE: index names must be globally unique across the public schema for drizzle-kit.
    index("idx_erector_validation_runs_user").on(t.user_id),
    index("idx_erector_validation_runs_blueprint").on(t.blueprint_id),
    index("idx_erector_validation_runs_verdict").on(t.verdict),
  ],
);

export const erectorVerdictDecisions = pgTable(
  "erector_verdict_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_run_id: uuid("validation_run_id")
      .notNull()
      .references(() => erectorValidationRuns.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id),
    rule_id: text("rule_id")
      .notNull()
      .references(() => erectorVerdictRules.rule_id),
    dimension: text("dimension").notNull(),
    input_value: jsonb("input_value").notNull().default(sql`'{}'::jsonb`),
    threshold_compared: jsonb("threshold_compared").notNull().default(sql`'{}'::jsonb`),
    severity: text("severity").notNull(),
    verdict_effect: text("verdict_effect").notNull(),
    fired: boolean("fired").notNull().default(true),
    rule_version: text("rule_version").notNull().default("v0.1"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_verdict_decisions_run").on(t.validation_run_id)],
);

export const erectorArchetypeRulePacks = pgTable("erector_archetype_rule_packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  archetype_id: text("archetype_id").notNull().unique(),
  archetype_name: text("archetype_name").notNull(),
  archetype_version: text("archetype_version").notNull().default("v0.1"),
  core_risk: text("core_risk").notNull(),
  risk_level: text("risk_level").notNull(),
  minimum_demand_proof_class: integer("minimum_demand_proof_class").notNull(),
  demand_proof_description: text("demand_proof_description").notNull(),
  proof_required: text("proof_required").array().notNull().default(sql`ARRAY[]::text[]`),
  proof_description: text("proof_description").notNull(),
  common_failure_modes: text("common_failure_modes").array().notNull().default(sql`ARRAY[]::text[]`),
  false_progress_patterns: text("false_progress_patterns").array().notNull().default(sql`ARRAY[]::text[]`),
  capital_pressure: text("capital_pressure").notNull(),
  capital_range_usd_min: integer("capital_range_usd_min"),
  capital_range_usd_max: integer("capital_range_usd_max"),
  timeline_pressure: text("timeline_pressure").notNull(),
  typical_months_to_traction: integer("typical_months_to_traction"),
  validation_blockers: text("validation_blockers").array().notNull().default(sql`ARRAY[]::text[]`),
  required_phase_gates: jsonb("required_phase_gates").notNull().default(sql`'[]'::jsonb`),
  correction_path_templates: jsonb("correction_path_templates").notNull().default(sql`'[]'::jsonb`),
  starter_adjustments: jsonb("starter_adjustments").notNull().default(sql`'{}'::jsonb`),
  growth_adjustments: jsonb("growth_adjustments").notNull().default(sql`'{}'::jsonb`),
  ultimate_adjustments: jsonb("ultimate_adjustments").notNull().default(sql`'{}'::jsonb`),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const erectorThresholdMatrix = pgTable("erector_threshold_matrix", {
  id: uuid("id").primaryKey().defaultRandom(),
  matrix_version: text("matrix_version").notNull().default("v0.1"),
  tier: text("tier").notNull().unique(),
  proceed_min_score: integer("proceed_min_score").notNull(),
  adjust_min_score: integer("adjust_min_score").notNull(),
  pivot_max_score: integer("pivot_max_score").notNull(),
  market_weight: numeric("market_weight", { precision: 3, scale: 2 }).notNull().default("0.30"),
  demand_weight: numeric("demand_weight", { precision: 3, scale: 2 }).notNull().default("0.30"),
  feasibility_weight: numeric("feasibility_weight", { precision: 3, scale: 2 })
    .notNull()
    .default("0.25"),
  context_weight: numeric("context_weight", { precision: 3, scale: 2 }).notNull().default("0.15"),
  band_blocked_max: integer("band_blocked_max").notNull().default(20),
  band_weak_max: integer("band_weak_max").notNull().default(40),
  band_unstable_max: integer("band_unstable_max").notNull().default(60),
  band_viable_max: integer("band_viable_max").notNull().default(80),
  demand_proof_min_class: integer("demand_proof_min_class").notNull(),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const erectorArchetypeClassifications = pgTable(
  "erector_archetype_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    validation_run_id: uuid("validation_run_id").references(() => erectorValidationRuns.id),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    primary_archetype: text("primary_archetype").notNull(),
    secondary_archetype: text("secondary_archetype"),
    tertiary_modifier: text("tertiary_modifier"),
    is_hybrid: boolean("is_hybrid").notNull().default(false),
    hybrid_blend: jsonb("hybrid_blend").notNull().default(sql`'{}'::jsonb`),
    classification_confidence: numeric("classification_confidence", { precision: 3, scale: 2 })
      .notNull()
      .default("0.70"),
    classification_reason: text("classification_reason").notNull(),
    rule_pack_id: text("rule_pack_id").notNull(),
    rule_pack_version: text("rule_pack_version").notNull().default("v0.1"),
    unit_economics: jsonb("unit_economics").notNull().default(sql`'{}'::jsonb`),
    classification_model_version: text("classification_model_version").notNull().default("v0.1"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_archetype_class_user").on(t.user_id),
    index("idx_archetype_class_blueprint").on(t.blueprint_id),
  ],
);

export const erectorEvidenceLedger = pgTable(
  "erector_evidence_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    task_id: uuid("task_id"),
    academy_task_id: uuid("academy_task_id"),
    outcome_id: uuid("outcome_id"),
    validation_run_id: uuid("validation_run_id").references(() => erectorValidationRuns.id),
    source_type: text("source_type").notNull(),
    source_location: text("source_location"),
    evidence_class: text("evidence_class").notNull(),
    evidence_strength: text("evidence_strength").notNull().default("LOW"),
    content_json: jsonb("content_json").notNull().default(sql`'{}'::jsonb`),
    content_summary: text("content_summary"),
    interpreted_by_bhudhi: boolean("interpreted_by_bhudhi").notNull().default(false),
    bhudhi_summary: text("bhudhi_summary"),
    bhudhi_log_id: uuid("bhudhi_log_id"),
    signal_generated: boolean("signal_generated").notNull().default(false),
    signal_id: uuid("signal_id"),
    validation_status: text("validation_status").notNull().default("pending"),
    contradiction_status: text("contradiction_status").notNull().default("none"),
    rejection_reason: text("rejection_reason"),
    linked_decision_ids: text("linked_decision_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    integrity_flags: text("integrity_flags").array().notNull().default(sql`ARRAY[]::text[]`),
    retention_policy: text("retention_policy").notNull().default("standard"),
    submitted_at: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    validated_at: timestamp("validated_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_evidence_user").on(t.user_id),
    index("idx_evidence_blueprint").on(t.blueprint_id),
    index("idx_evidence_class").on(t.evidence_class),
    index("idx_evidence_status").on(t.validation_status),
  ],
);

export const erectorSignals = pgTable(
  "erector_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    validation_run_id: uuid("validation_run_id").references(() => erectorValidationRuns.id),
    signal_type: text("signal_type").notNull(),
    value: integer("value").notNull().default(0),
    confidence: text("confidence").notNull().default("LOW"),
    source_evidence_ids: text("source_evidence_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    source_execution_data: jsonb("source_execution_data").notNull().default(sql`'{}'::jsonb`),
    calculation_method: text("calculation_method").notNull(),
    threshold_compared: integer("threshold_compared"),
    threshold_result: text("threshold_result"),
    status: text("status").notNull().default("current"),
    consumed_by_decision_ids: text("consumed_by_decision_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    signal_calculation_version: text("signal_calculation_version").notNull().default("v0.1"),
    generated_at: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_erector_signals_user").on(t.user_id),
    index("idx_erector_signals_blueprint").on(t.blueprint_id),
    index("idx_erector_signals_type").on(t.signal_type),
  ],
);

export const erectorSimulationRuns = pgTable(
  "erector_simulation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    validation_run_id: uuid("validation_run_id")
      .notNull()
      .references(() => erectorValidationRuns.id),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    archetype_classification_id: uuid("archetype_classification_id").references(
      () => erectorArchetypeClassifications.id,
    ),
    tier: text("tier").notNull(),
    primary_archetype: text("primary_archetype").notNull(),
    secondary_archetype: text("secondary_archetype"),
    archetype_confidence: numeric("archetype_confidence", { precision: 3, scale: 2 })
      .notNull()
      .default("0.70"),
    probability_proceed: integer("probability_proceed"),
    probability_adjust: integer("probability_adjust"),
    probability_failure: integer("probability_failure"),
    simulation_confidence: text("simulation_confidence").notNull().default("LOW"),
    best_case_description: text("best_case_description"),
    best_case_probability: integer("best_case_probability"),
    best_case_timeline_adj: text("best_case_timeline_adj"),
    best_case_conditions: text("best_case_conditions").array().notNull().default(sql`ARRAY[]::text[]`),
    best_case_risks: text("best_case_risks").array().notNull().default(sql`ARRAY[]::text[]`),
    best_case_warning_triggers: text("best_case_warning_triggers")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    base_case_description: text("base_case_description"),
    base_case_probability: integer("base_case_probability"),
    base_case_timeline_adj: text("base_case_timeline_adj"),
    base_case_risks: text("base_case_risks").array().notNull().default(sql`ARRAY[]::text[]`),
    base_case_blockers: text("base_case_blockers").array().notNull().default(sql`ARRAY[]::text[]`),
    downside_description: text("downside_description"),
    downside_probability: integer("downside_probability"),
    downside_timeline_adj: text("downside_timeline_adj"),
    downside_failure_modes: text("downside_failure_modes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    downside_correction_path: text("downside_correction_path"),
    economic_constraints: jsonb("economic_constraints").notNull().default(sql`'{}'::jsonb`),
    civilization_constraints: jsonb("civilization_constraints").notNull().default(sql`'{}'::jsonb`),
    framework_verdicts: jsonb("framework_verdicts").notNull().default(sql`'[]'::jsonb`),
    hard_vetoes: text("hard_vetoes").array().notNull().default(sql`ARRAY[]::text[]`),
    soft_risks: text("soft_risks").array().notNull().default(sql`ARRAY[]::text[]`),
    veto_active: boolean("veto_active").notNull().default(false),
    veto_frameworks: text("veto_frameworks").array().notNull().default(sql`ARRAY[]::text[]`),
    veto_reasons: text("veto_reasons").array().notNull().default(sql`ARRAY[]::text[]`),
    recommended_path: text("recommended_path"),
    verdict: text("verdict"),
    simulation_model_version: text("simulation_model_version").notNull().default("v0.1"),
    archetype_rule_pack_version: text("archetype_rule_pack_version").notNull().default("v0.1"),
    status: text("status").notNull().default("pending"),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_simulation_runs_user").on(t.user_id),
    index("idx_simulation_runs_blueprint").on(t.blueprint_id),
  ],
);

export const erectorFrameworkVetoRules = pgTable(
  "erector_framework_veto_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    framework_id: text("framework_id").notNull().unique(),
    framework_name: text("framework_name").notNull(),
    rule_version: text("rule_version").notNull().default("v0.1"),
    active_individual: boolean("active_individual").notNull().default(false),
    active_team: boolean("active_team").notNull().default(false),
    condition_description: text("condition_description").notNull(),
    required_evidence: text("required_evidence").array().notNull().default(sql`ARRAY[]::text[]`),
    threshold: jsonb("threshold").notNull().default(sql`'{}'::jsonb`),
    veto_type: text("veto_type").notNull(),
    verdict_effect: text("verdict_effect").notNull(),
    correction_required: text("correction_required").notNull(),
    revalidation_required: boolean("revalidation_required").notNull().default(true),
    user_visible_reason: text("user_visible_reason").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_veto_rules_framework").on(t.framework_id)],
);

export const erectorBlueprintLaunchContracts = pgTable(
  "erector_blueprint_launch_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id),
    validation_run_id: uuid("validation_run_id")
      .notNull()
      .references(() => erectorValidationRuns.id),
    simulation_run_id: uuid("simulation_run_id").references(() => erectorSimulationRuns.id),
    archetype_classification_id: uuid("archetype_classification_id").references(
      () => erectorArchetypeClassifications.id,
    ),
    launch_permission: text("launch_permission").notNull(),
    structured_goal: text("structured_goal").notNull(),
    structured_purpose: jsonb("structured_purpose").notNull().default(sql`'{}'::jsonb`),
    selected_path: text("selected_path").notNull(),
    economic_archetype: text("economic_archetype").notNull(),
    policy_rules: text("policy_rules").array().notNull().default(sql`ARRAY[]::text[]`),
    policy_dont: text("policy_dont").array().notNull().default(sql`ARRAY[]::text[]`),
    risk_flags: text("risk_flags").array().notNull().default(sql`ARRAY[]::text[]`),
    hard_blockers: text("hard_blockers").array().notNull().default(sql`ARRAY[]::text[]`),
    soft_blockers: text("soft_blockers").array().notNull().default(sql`ARRAY[]::text[]`),
    winning_conditions: text("winning_conditions").array().notNull().default(sql`ARRAY[]::text[]`),
    failure_conditions: text("failure_conditions").array().notNull().default(sql`ARRAY[]::text[]`),
    required_signals: jsonb("required_signals").notNull().default(sql`'{}'::jsonb`),
    academy_requirements: jsonb("academy_requirements").notNull().default(sql`'[]'::jsonb`),
    required_phase_gates: jsonb("required_phase_gates").notNull().default(sql`'[]'::jsonb`),
    simulation_summary: jsonb("simulation_summary").notNull().default(sql`'{}'::jsonb`),
    framework_verdicts: jsonb("framework_verdicts").notNull().default(sql`'[]'::jsonb`),
    tier: text("tier").notNull(),
    tier_permissions: jsonb("tier_permissions").notNull().default(sql`'{}'::jsonb`),
    audit_id: uuid("audit_id"),
    contract_version: text("contract_version").notNull().default("v0.1"),
    consumed: boolean("consumed").notNull().default(false),
    consumed_at: timestamp("consumed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_launch_contracts_blueprint").on(t.blueprint_id),
    uniqueIndex("idx_launch_contracts_blueprint_unique")
      .on(t.blueprint_id)
      .where(sql`consumed = false`),
  ],
);

export const erectorCorrectionPaths = pgTable(
  "erector_correction_paths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    validation_run_id: uuid("validation_run_id").references(() => erectorValidationRuns.id),
    source_engine: text("source_engine").notNull(),
    source_id: text("source_id").notNull(),
    correction_type: text("correction_type").notNull(),
    blocked_action: text("blocked_action").notNull(),
    reason: text("reason").notNull(),
    user_visible_reason: text("user_visible_reason").notNull(),
    required_actions: text("required_actions").array().notNull().default(sql`ARRAY[]::text[]`),
    required_evidence: text("required_evidence").array().notNull().default(sql`ARRAY[]::text[]`),
    revalidation_required: boolean("revalidation_required").notNull().default(false),
    unblock_condition: text("unblock_condition").notNull(),
    status: text("status").notNull().default("open"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    resolved_by: text("resolved_by"),
    audit_id: uuid("audit_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_correction_paths_user").on(t.user_id),
    index("idx_correction_paths_status").on(t.status),
  ],
);
