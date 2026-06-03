import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { userTierEnum } from "./enums.js";
import { bhudhiLogs, blueprints, users, validations } from "./tables.js";

/** Tier preview cards shown after validation (one row per tier). */
export const blueprintTierPreviews = pgTable(
  "blueprint_tier_previews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_id: uuid("validation_id")
      .notNull()
      .references(() => validations.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tier: userTierEnum("tier").notNull(),
    headline: text("headline").notNull(),
    description: text("description").notNull(),
    plan_count: integer("plan_count").notNull(),
    target_types: text("target_types").array().notNull().default(sql`ARRAY[]::text[]`),
    signal_system: text("signal_system").notNull(),
    task_style: text("task_style").notNull(),
    ai_depth: text("ai_depth").notNull(),
    highlights: jsonb("highlights").notNull().default(sql`'[]'::jsonb`),
    growth_projection: jsonb("growth_projection").notNull().default(sql`'{}'::jsonb`),
    recommended: boolean("recommended").notNull().default(false),
    recommendation_reason: text("recommendation_reason"),
    selected: boolean("selected").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_blueprint_tier_previews_validation_id").on(t.validation_id),
    index("idx_blueprint_tier_previews_user_id").on(t.user_id),
  ],
);

/** Audit log for blueprint chain generation runs. */
export const blueprintGenerationLog = pgTable(
  "blueprint_generation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    validation_id: uuid("validation_id")
      .notNull()
      .references(() => validations.id, { onDelete: "cascade" }),
    tier: userTierEnum("tier").notNull(),
    generation_trigger: text("generation_trigger").notNull().default("tier_selected"),
    layers_generated: jsonb("layers_generated").notNull().default(sql`'{}'::jsonb`),
    plans_created: integer("plans_created").notNull().default(0),
    seasons_created: integer("seasons_created").notNull().default(0),
    targets_created: integer("targets_created").notNull().default(0),
    phases_created: integer("phases_created").notNull().default(0),
    projects_created: integer("projects_created").notNull().default(0),
    actions_created: integer("actions_created").notNull().default(0),
    bhudhi_used: boolean("bhudhi_used").notNull().default(false),
    bhudhi_log_id: uuid("bhudhi_log_id").references(() => bhudhiLogs.id, { onDelete: "set null" }),
    fallback_used: boolean("fallback_used").notNull().default(false),
    fallback_reason: text("fallback_reason"),
    duration_ms: integer("duration_ms"),
    status: text("status").notNull().default("complete"),
    error: text("error"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_blueprint_generation_log_blueprint_id").on(t.blueprint_id),
    index("idx_blueprint_generation_log_user_id").on(t.user_id),
    index("idx_blueprint_generation_log_validation_id").on(t.validation_id),
  ],
);
