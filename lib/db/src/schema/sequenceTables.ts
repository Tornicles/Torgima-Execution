/**
 * Blueprint sequence tracking — Starter / Growth / Ultimate flows.
 * Spec: SEQUENCE_SPECIFICATION_DATABASE.md
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  jsonb,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { blueprints } from "./tables.js";

const blueprintFk = (name: string) =>
  uuid(name)
    .notNull()
    .references(() => blueprints.id, { onDelete: "cascade" });

export const blueprintSequences = pgTable(
  "blueprint_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    current_sequence: integer("current_sequence").notNull().default(1),
    current_sequence_name: text("current_sequence_name").notNull().default("GOAL"),
    completed_sequences: text("completed_sequences").array().notNull().default(sql`ARRAY[]::text[]`),
    sequence_timestamps: jsonb("sequence_timestamps").notNull().default(sql`'{}'::jsonb`),
    sequence_states: jsonb("sequence_states").notNull().default(sql`'{}'::jsonb`),
    sequence_validation: jsonb("sequence_validation").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_blueprint_sequences_blueprint_id").on(t.blueprint_id)],
);

export const goalSequences = pgTable(
  "goal_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    goal_text: text("goal_text").notNull(),
    outcome: text("outcome"),
    intent: text("intent"),
    category: text("category"),
    direction: text("direction"),
    success_metrics: jsonb("success_metrics"),
    expected_outputs: text("expected_outputs").array(),
    goal_score: doublePrecision("goal_score"),
    current_goal: text("current_goal"),
    expected_goal: text("expected_goal"),
    future_goal: text("future_goal"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_goal_sequences_blueprint_id").on(t.blueprint_id)],
);

export const purposeSequences = pgTable(
  "purpose_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    purpose_text: text("purpose_text").notNull(),
    problem: text("problem"),
    value: text("value"),
    change: text("change"),
    mission: text("mission"),
    target_user: text("target_user"),
    desired_change: text("desired_change"),
    execution_intent: text("execution_intent"),
    purpose_hierarchy: jsonb("purpose_hierarchy"),
    purpose_durability: doublePrecision("purpose_durability"),
    purpose_conflict: text("purpose_conflict").array(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_purpose_sequences_blueprint_id").on(t.blueprint_id)],
);

export const contextSequences = pgTable(
  "context_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    timeframe: integer("timeframe"),
    location: text("location"),
    business_type: text("business_type"),
    delivery: text("delivery"),
    people_count: integer("people_count"),
    commitment: text("commitment"),
    budget: doublePrecision("budget"),
    limits: text("limits").array(),
    execution_pressure: doublePrecision("execution_pressure"),
    capability_expected: text("capability_expected"),
    workload_model: jsonb("workload_model"),
    operating_rules: jsonb("operating_rules"),
    constraint_forecast: jsonb("constraint_forecast"),
    recovery_models: jsonb("recovery_models"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_context_sequences_blueprint_id").on(t.blueprint_id)],
);

export const validationSequences = pgTable(
  "validation_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    reality_result: text("reality_result"),
    demand: doublePrecision("demand"),
    competition: text("competition"),
    timing: text("timing"),
    feasibility: doublePrecision("feasibility"),
    risk: text("risk"),
    current_path: text("current_path"),
    adjusted_path: text("adjusted_path"),
    alternative_path: text("alternative_path"),
    verdict: text("verdict"),
    risk_weight: jsonb("risk_weight"),
    path_comparison: jsonb("path_comparison"),
    feasibility_score: doublePrecision("feasibility_score"),
    validation_drift: doublePrecision("validation_drift"),
    live_revalidation: timestamp("live_revalidation", { withTimezone: true }),
    execution_forecast: jsonb("execution_forecast"),
    is_active: boolean("is_active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_validation_sequences_blueprint_id").on(t.blueprint_id)],
);

export const validationResultSequences = pgTable(
  "validation_result_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    selected_path: text("selected_path"),
    path_memory: jsonb("path_memory"),
    expected_scenario: jsonb("expected_scenario"),
    failure_scenario: jsonb("failure_scenario"),
    recovery_scenario: jsonb("recovery_scenario"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_validation_result_sequences_blueprint_id").on(t.blueprint_id)],
);

export const blueprintTierSequences = pgTable(
  "blueprint_tier_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    selected_tier: text("selected_tier").notNull(),
    tier_rules: jsonb("tier_rules"),
    complexity_level: integer("complexity_level"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_blueprint_tier_sequences_blueprint_id").on(t.blueprint_id)],
);

export const policySequences = pgTable(
  "policy_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    do_rules: text("do_rules").array(),
    dont_rules: text("dont_rules").array(),
    winning_rules: text("winning_rules").array(),
    failure_rules: text("failure_rules").array(),
    operational_standard: text("operational_standard").array(),
    task_influence: jsonb("task_influence"),
    failure_patterns: text("failure_patterns").array(),
    adaptive_policies: jsonb("adaptive_policies"),
    conditional_policies: jsonb("conditional_policies"),
    learning_policies: jsonb("learning_policies"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_policy_sequences_blueprint_id").on(t.blueprint_id)],
);

export const masterPlanSequences = pgTable(
  "master_plan_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    mission: text("mission"),
    success: text("success"),
    rules: text("rules").array(),
    deliverables: text("deliverables").array(),
    progress_governance: jsonb("progress_governance"),
    governance_type: text("governance_type"),
    change_detection: text("change_detection"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_master_plan_sequences_blueprint_id").on(t.blueprint_id)],
);

export const signalSequences = pgTable(
  "signal_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    signals: text("signals").array(),
    signal_history: jsonb("signal_history"),
    signal_trend: jsonb("signal_trend"),
    signal_momentum: jsonb("signal_momentum"),
    signal_forecast: jsonb("signal_forecast"),
    signal_pressure: jsonb("signal_pressure"),
    signal_probability: jsonb("signal_probability"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_signal_sequences_blueprint_id").on(t.blueprint_id)],
);

export const miniPlanAllocationHistory = pgTable(
  "mini_plan_allocation_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    user_id: uuid("user_id").notNull(),
    condition: text("condition").notNull(),
    allocation: jsonb("allocation").notNull().default(sql`'{}'::jsonb`),
    daily_task_counts: jsonb("daily_task_counts"),
    previous_condition: text("previous_condition"),
    reason: text("reason"),
    tasks_affected: integer("tasks_affected").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_mini_plan_allocation_history_blueprint").on(t.blueprint_id, t.created_at),
  ],
);

export const miniPlanSequences = pgTable(
  "mini_plan_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    mini_plans: text("mini_plans").array(),
    cross_plan_prep: jsonb("cross_plan_prep"),
    dependency_aware: jsonb("dependency_aware"),
    can_compete: boolean("can_compete").notNull().default(true),
    can_collaborate: boolean("can_collaborate").notNull().default(true),
    can_reallocate: boolean("can_reallocate").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_mini_plan_sequences_blueprint_id").on(t.blueprint_id)],
);

export const executionStructureSequences = pgTable(
  "execution_structure_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    targets: jsonb("targets"),
    target_control: jsonb("target_control"),
    target_tree: jsonb("target_tree"),
    target_compounding: jsonb("target_compounding"),
    target_forecast: jsonb("target_forecast"),
    phases: text("phases").array(),
    phase_gates: jsonb("phase_gates"),
    phase_flex: jsonb("phase_flex"),
    project_structure: jsonb("project_structure"),
    action_types: text("action_types").array(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_execution_structure_sequences_blueprint_id").on(t.blueprint_id)],
);

export const taskGenerationSequences = pgTable(
  "task_generation_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    current_orders: jsonb("current_orders"),
    current_order_count: integer("current_order_count"),
    hidden_orders: jsonb("hidden_orders"),
    hidden_queue_length: integer("hidden_queue_length"),
    task_mutation: jsonb("task_mutation"),
    context_injection: text("context_injection").array(),
    future_orders: jsonb("future_orders"),
    emergency_orders: jsonb("emergency_orders"),
    opportunity_orders: jsonb("opportunity_orders"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_task_generation_sequences_blueprint_id").on(t.blueprint_id)],
);

export const executionFeedbackSequences = pgTable(
  "execution_feedback_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    execution_output: text("execution_output"),
    execution_result: jsonb("execution_result"),
    execution_speed: doublePrecision("execution_speed"),
    execution_behavior: jsonb("execution_behavior"),
    execution_pattern: text("execution_pattern"),
    completion: text("completion"),
    score: integer("score"),
    reflection: text("reflection"),
    confidence: doublePrecision("confidence"),
    interrogation: jsonb("interrogation"),
    behavior_extracted: jsonb("behavior_extracted"),
    reality_learning: jsonb("reality_learning"),
    contradictions: jsonb("contradictions"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_execution_feedback_sequences_blueprint_id").on(t.blueprint_id)],
);

export const signalConditionSequences = pgTable(
  "signal_condition_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    signal_progress: doublePrecision("signal_progress"),
    signal_momentum: doublePrecision("signal_momentum"),
    signal_consistency: doublePrecision("signal_consistency"),
    signal_history: jsonb("signal_history"),
    signal_trend: text("signal_trend"),
    signal_forecast: text("signal_forecast"),
    signal_trajectory: jsonb("signal_trajectory"),
    current_condition: text("current_condition"),
    task_control: jsonb("task_control"),
    difficulty_control: jsonb("difficulty_control"),
    permission_control: jsonb("permission_control"),
    can_reduce: boolean("can_reduce"),
    can_increase: boolean("can_increase"),
    can_delay: boolean("can_delay"),
    can_prioritize: boolean("can_prioritize"),
    adaptation_triggered: boolean("adaptation_triggered").notNull().default(false),
    adaptation_type: text("adaptation_type"),
    correction_tasks: text("correction_tasks").array(),
    recovery_tasks: text("recovery_tasks").array(),
    rebuild: boolean("rebuild"),
    restructure: boolean("restructure"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_signal_condition_sequences_blueprint_id").on(t.blueprint_id)],
);

export const predictionSceneSequences = pgTable(
  "prediction_scene_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    future_scene: text("future_scene"),
    expected_risk: jsonb("expected_risk"),
    probability: doublePrecision("probability"),
    queue_mutation: jsonb("queue_mutation"),
    next_orders: jsonb("next_orders"),
    regeneration_trigger: text("regeneration_trigger"),
    current_scene: text("current_scene"),
    expected_scene: text("expected_scene"),
    ideal_scene: text("ideal_scene"),
    how_to_move_forward: text("how_to_move_forward"),
    projected_scene: text("projected_scene"),
    scene_probability: doublePrecision("scene_probability"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_prediction_scene_sequences_blueprint_id").on(t.blueprint_id)],
);

export const sequenceFlows = pgTable(
  "sequence_flows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    total_sequences: integer("total_sequences").notNull(),
    completed_sequences: integer("completed_sequences").notNull().default(0),
    current_sequence_num: integer("current_sequence_num").notNull().default(1),
    current_sequence_name: text("current_sequence_name").notNull().default("GOAL"),
    flow_path: text("flow_path").array().notNull(),
    sequence_duration: jsonb("sequence_duration").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uniq_sequence_flows_blueprint_id").on(t.blueprint_id),
    index("idx_sequence_flows_current").on(t.current_sequence_name),
  ],
);
