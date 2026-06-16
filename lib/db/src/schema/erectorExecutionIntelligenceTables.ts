/**
 * ERECTOR SCHEMA 2 — Execution Intelligence tables.
 * Academy capability system, phase gates, false progress patterns, resimulation.
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
import { blueprints, phases, users } from "./tables";
import {
  erectorCorrectionPaths,
  erectorSimulationRuns,
} from "./erectorCoreRuntimeTables";

export const erectorCapabilityGraph = pgTable(
  "erector_capability_graph",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    capability_id: text("capability_id").notNull().unique(),
    capability_name: text("capability_name").notNull(),
    capability_description: text("capability_description").notNull(),
    domain: text("domain").notNull(),
    phase_relevance: text("phase_relevance").array().notNull().default(sql`ARRAY[]::text[]`),
    required_for_task_types: text("required_for_task_types")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    prerequisite_capabilities: text("prerequisite_capabilities")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    proof_required: text("proof_required").notNull(),
    evidence_types_allowed: text("evidence_types_allowed")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    minimum_signal_threshold: integer("minimum_signal_threshold").notNull().default(60),
    available_starter: boolean("available_starter").notNull().default(true),
    available_growth: boolean("available_growth").notNull().default(true),
    available_ultimate: boolean("available_ultimate").notNull().default(true),
    decay_rule: text("decay_rule").notNull().default("none"),
    decay_threshold_days: integer("decay_threshold_days"),
    upgrade_to_capability: text("upgrade_to_capability"),
    active: boolean("active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_capability_graph_domain").on(t.domain)],
);

export const erectorCapabilityGaps = pgTable(
  "erector_capability_gaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id),
    task_id: uuid("task_id"),
    capability_id: text("capability_id")
      .notNull()
      .references(() => erectorCapabilityGraph.capability_id),
    current_proof_level: text("current_proof_level").notNull().default("none"),
    required_proof_level: text("required_proof_level").notNull().default("proven"),
    missing_evidence: text("missing_evidence").array().notNull().default(sql`ARRAY[]::text[]`),
    block_level: text("block_level").notNull().default("soft"),
    blocks_execution: boolean("blocks_execution").notNull().default(false),
    academy_task_id: uuid("academy_task_id"),
    unblock_condition: text("unblock_condition").notNull(),
    status: text("status").notNull().default("open"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_capability_gaps_user").on(t.user_id),
    index("idx_capability_gaps_blueprint").on(t.blueprint_id),
    index("idx_capability_gaps_status").on(t.status),
  ],
);

export const erectorCapabilityProfiles = pgTable(
  "erector_capability_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    capability_id: text("capability_id")
      .notNull()
      .references(() => erectorCapabilityGraph.capability_id),
    proof_level: text("proof_level").notNull().default("none"),
    proof_count: integer("proof_count").notNull().default(0),
    last_proof_evidence_id: uuid("last_proof_evidence_id"),
    last_proven_at: timestamp("last_proven_at", { withTimezone: true }),
    capability_signal: integer("capability_signal").notNull().default(0),
    signal_confidence: text("signal_confidence").notNull().default("LOW"),
    decay_status: text("decay_status").notNull().default("current"),
    decays_at: timestamp("decays_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_cap_profile_unique").on(t.user_id, t.capability_id),
  ],
);

export const erectorPhaseGates = pgTable(
  "erector_phase_gates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id),
    phase_id: uuid("phase_id")
      .notNull()
      .references(() => phases.id),
    phase_name: text("phase_name").notNull(),
    archetype: text("archetype").notNull(),
    gate_criteria: jsonb("gate_criteria").notNull().default(sql`'{}'::jsonb`),
    evidence_ids: text("evidence_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    outcome_validation_ids: text("outcome_validation_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    capability_gap_ids: text("capability_gap_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    false_progress_flags: text("false_progress_flags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    readiness_score: integer("readiness_score").notNull().default(0),
    gate_result: text("gate_result").notNull(),
    blocking_reasons: text("blocking_reasons").array().notNull().default(sql`ARRAY[]::text[]`),
    correction_path_id: uuid("correction_path_id").references(() => erectorCorrectionPaths.id),
    gate_version: text("gate_version").notNull().default("v0.1"),
    evaluated_at: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_phase_gates_blueprint").on(t.blueprint_id),
    index("idx_phase_gates_result").on(t.gate_result),
  ],
);

export const erectorFalseProgressPatterns = pgTable("erector_false_progress_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  pattern_id: text("pattern_id").notNull().unique(),
  archetype: text("archetype").notNull(),
  pattern_name: text("pattern_name").notNull(),
  pattern_description: text("pattern_description").notNull(),
  detection_logic: text("detection_logic").notNull(),
  example: text("example").notNull(),
  response_action: text("response_action").notNull(),
  severity: text("severity").notNull().default("MEDIUM"),
  active: boolean("active").notNull().default(true),
  pattern_version: text("pattern_version").notNull().default("v0.1"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const erectorResimulationRuns = pgTable(
  "erector_resimulation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id),
    original_simulation_id: uuid("original_simulation_id")
      .notNull()
      .references(() => erectorSimulationRuns.id),
    trigger_type: text("trigger_type").notNull(),
    trigger_description: text("trigger_description").notNull(),
    changed_inputs: jsonb("changed_inputs").notNull().default(sql`'{}'::jsonb`),
    previous_probability: integer("previous_probability"),
    updated_probability: integer("updated_probability"),
    probability_delta: integer("probability_delta"),
    new_risk_flags: text("new_risk_flags").array().notNull().default(sql`ARRAY[]::text[]`),
    new_correction_paths: jsonb("new_correction_paths").notNull().default(sql`'[]'::jsonb`),
    verdict_changed: boolean("verdict_changed").notNull().default(false),
    previous_verdict: text("previous_verdict"),
    new_verdict: text("new_verdict"),
    audit_id: uuid("audit_id"),
    resimulation_model_version: text("resimulation_model_version").notNull().default("v0.1"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_resimulation_blueprint").on(t.blueprint_id)],
);
