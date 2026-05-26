/**
 * Ultimate tier features — Sequence 25 (Prompt 3).
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
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { blueprints } from "./tables.js";

const blueprintFk = (name: string) =>
  uuid(name)
    .notNull()
    .references(() => blueprints.id, { onDelete: "cascade" });

export const ultimatePredictions = pgTable(
  "ultimate_predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    sequence_number: integer("sequence_number").notNull(),
    predicted_task: text("predicted_task").notNull(),
    predicted_blockers: text("predicted_blockers").array().notNull().default(sql`ARRAY[]::text[]`),
    predicted_duration: integer("predicted_duration"),
    task_confidence: doublePrecision("task_confidence").notNull(),
    blocker_risk: doublePrecision("blocker_risk").notNull(),
    accuracy_history: doublePrecision("accuracy_history").notNull().default(0.5),
    actual_task: text("actual_task"),
    actual_blockers: text("actual_blockers").array().notNull().default(sql`ARRAY[]::text[]`),
    prediction_correct: boolean("prediction_correct"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    validated_at: timestamp("validated_at", { withTimezone: true }),
  },
  (t) => [index("idx_ultimate_predictions_blueprint_id").on(t.blueprint_id)],
);

export const ultimateScenes = pgTable(
  "ultimate_scenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    sequence_number: integer("sequence_number").notNull(),
    current_state: jsonb("current_state").notNull().default(sql`'{}'::jsonb`),
    expected_state: jsonb("expected_state").notNull().default(sql`'{}'::jsonb`),
    ideal_state: jsonb("ideal_state").notNull().default(sql`'{}'::jsonb`),
    current_vs_expected: doublePrecision("current_vs_expected").notNull(),
    expected_vs_ideal: doublePrecision("expected_vs_ideal").notNull(),
    blocker_gaps: text("blocker_gaps").array().notNull().default(sql`ARRAY[]::text[]`),
    opportunity_gaps: text("opportunity_gaps").array().notNull().default(sql`ARRAY[]::text[]`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_ultimate_scenes_blueprint_id").on(t.blueprint_id)],
);

export const ultimateValidationCheckpoints = pgTable(
  "ultimate_validation_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    sequence_number: integer("sequence_number").notNull(),
    execution_valid: boolean("execution_valid").notNull(),
    prediction_valid: boolean("prediction_valid").notNull(),
    scene_valid: boolean("scene_valid").notNull(),
    validation_errors: text("validation_errors").array().notNull().default(sql`ARRAY[]::text[]`),
    warnings: text("warnings").array().notNull().default(sql`ARRAY[]::text[]`),
    recovery_needed: boolean("recovery_needed").notNull().default(false),
    recovery_type: text("recovery_type"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_ultimate_validation_checkpoints_blueprint_id").on(t.blueprint_id),
    index("idx_ultimate_validation_checkpoints_recovery").on(t.recovery_needed),
  ],
);

export const ultimateEmergencyOrders = pgTable(
  "ultimate_emergency_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    sequence_number: integer("sequence_number").notNull(),
    trigger_event: text("trigger_event").notNull(),
    order_type: text("order_type").notNull(),
    task_description: text("task_description").notNull(),
    urgency: text("urgency").notNull(),
    estimated_impact: text("estimated_impact").notNull(),
    status: text("status").notNull().default("pending"),
    linked_order_id: uuid("linked_order_id"),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    effectiveness: doublePrecision("effectiveness"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_ultimate_emergency_orders_blueprint_id").on(t.blueprint_id),
    index("idx_ultimate_emergency_orders_status").on(t.status),
    index("idx_ultimate_emergency_orders_trigger").on(t.trigger_event),
  ],
);
