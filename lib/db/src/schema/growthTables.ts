/**
 * Growth tier features — Sequence 24+ (Prompt 2).
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

export const interrogationLogs = pgTable(
  "interrogation_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    sequence_number: integer("sequence_number").notNull(),
    question: text("question").notNull(),
    context: text("context").notNull(),
    user_answer: text("user_answer"),
    category: text("category").notNull(),
    insight_extracted: text("insight_extracted"),
    insight_actionable: boolean("insight_actionable").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_interrogation_logs_blueprint_id").on(t.blueprint_id),
    index("idx_interrogation_logs_sequence_number").on(t.sequence_number),
  ],
);

export const knowledgeCards = pgTable(
  "knowledge_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    tier: text("tier").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    relevant_at_seq: integer("relevant_at_seq"),
    keyword_triggers: text("keyword_triggers").array().notNull().default(sql`ARRAY[]::text[]`),
    viewed_count: integer("viewed_count").notNull().default(0),
    helpful_count: integer("helpful_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_knowledge_cards_blueprint_id").on(t.blueprint_id),
    index("idx_knowledge_cards_tier").on(t.tier),
    uniqueIndex("uniq_knowledge_cards_blueprint_title").on(t.blueprint_id, t.title),
  ],
);

export const adaptationSuggestions = pgTable(
  "adaptation_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    sequence_number: integer("sequence_number").notNull(),
    pattern_detected: text("pattern_detected").notNull(),
    category: text("category").notNull(),
    current_behavior: text("current_behavior").notNull(),
    suggested_change: text("suggested_change").notNull(),
    reasoning: text("reasoning").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    user_applied: boolean("user_applied").notNull().default(false),
    applied_date: timestamp("applied_date", { withTimezone: true }),
    effectiveness: doublePrecision("effectiveness"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_adaptation_suggestions_blueprint_id").on(t.blueprint_id),
    index("idx_adaptation_suggestions_sequence_number").on(t.sequence_number),
  ],
);

export const growthExecutionPatterns = pgTable(
  "growth_execution_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprint_id: blueprintFk("blueprint_id"),
    pattern_type: text("pattern_type").notNull(),
    pattern_name: text("pattern_name").notNull(),
    detected_at_seq: integer("detected_at_seq").notNull(),
    occurrence_count: integer("occurrence_count").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    impact: text("impact"),
    is_learnable: boolean("is_learnable").notNull().default(true),
    suggested_fix: text("suggested_fix"),
    last_observed: timestamp("last_observed", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_growth_execution_patterns_blueprint_id").on(t.blueprint_id),
    index("idx_growth_execution_patterns_pattern_type").on(t.pattern_type),
    uniqueIndex("uniq_growth_execution_patterns_blueprint_type_name").on(
      t.blueprint_id,
      t.pattern_type,
      t.pattern_name,
    ),
  ],
);
