import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { blueprints, users, validations } from "./tables";

export const validationRuns = pgTable(
  "validation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_draft_id: uuid("blueprint_draft_id").references(() => blueprints.id, {
      onDelete: "set null",
    }),
    legacy_validation_id: uuid("legacy_validation_id").references(() => validations.id, {
      onDelete: "set null",
    }),
    idea_title: text("idea_title").notNull(),
    idea_description: text("idea_description"),
    goal: text("goal").notNull(),
    purpose: text("purpose").notNull(),
    timeframe: text("timeframe").notNull(),
    context: text("context"),
    commitment_level: text("commitment_level"),
    domain_hints: jsonb("domain_hints").default(sql`'[]'::jsonb`),
    known_blockers: text("known_blockers"),
    status: text("status").notNull().default("pending"),
    bhudhi_research_job_id: text("bhudhi_research_job_id"),
    research_completed_at: timestamp("research_completed_at", { withTimezone: true }),
    verdict: text("verdict"),
    reality_score: integer("reality_score"),
    reality_score_label: text("reality_score_label"),
    verdict_summary: text("verdict_summary"),
    verdict_badge: text("verdict_badge"),
    selected_path: text("selected_path"),
    blueprint_launched: boolean("blueprint_launched").notNull().default(false),
    launched_blueprint_id: uuid("launched_blueprint_id").references(() => blueprints.id, {
      onDelete: "set null",
    }),
    launched_at: timestamp("launched_at", { withTimezone: true }),
    is_direction_anchor: boolean("is_direction_anchor").notNull().default(false),
    explanation_paragraphs: jsonb("explanation_paragraphs").default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("idx_validation_runs_user").on(t.user_id),
    index("idx_validation_runs_status").on(t.status),
    index("idx_validation_runs_blueprint_draft").on(t.blueprint_draft_id),
  ],
);

export const validationAtAGlance = pgTable(
  "validation_at_a_glance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_run_id: uuid("validation_run_id")
      .notNull()
      .references(() => validationRuns.id, { onDelete: "cascade" }),
    problem_exists: text("problem_exists"),
    problem_exists_summary: text("problem_exists_summary"),
    market_demand: text("market_demand"),
    market_demand_summary: text("market_demand_summary"),
    competition_level: text("competition_level"),
    competition_summary: text("competition_summary"),
    execution_fit: text("execution_fit"),
    execution_fit_summary: text("execution_fit_summary"),
    feasibility: text("feasibility"),
    feasibility_summary: text("feasibility_summary"),
    timing: text("timing"),
    timing_summary: text("timing_summary"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_at_a_glance_run").on(t.validation_run_id)],
);

export const validationMarketTrends = pgTable("validation_market_trends", {
  id: uuid("id").primaryKey().defaultRandom(),
  validation_run_id: uuid("validation_run_id")
    .notNull()
    .references(() => validationRuns.id, { onDelete: "cascade" }),
  trend_summary: text("trend_summary").notNull(),
  trend_position: text("trend_position").notNull(),
  growth_rate: text("growth_rate"),
  growth_rate_raw: doublePrecision("growth_rate_raw"),
  chart_data: jsonb("chart_data").default(sql`'[]'::jsonb`),
  sources: jsonb("sources").default(sql`'[]'::jsonb`),
  bhudhi_confidence: text("bhudhi_confidence"),
  researched_at: timestamp("researched_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const validationCompetitors = pgTable(
  "validation_competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_run_id: uuid("validation_run_id")
      .notNull()
      .references(() => validationRuns.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    website: text("website"),
    logo_url: text("logo_url"),
    market_share_pct: doublePrecision("market_share_pct"),
    market_share_label: text("market_share_label"),
    strengths: jsonb("strengths").default(sql`'[]'::jsonb`),
    weaknesses: jsonb("weaknesses").default(sql`'[]'::jsonb`),
    relevance_summary: text("relevance_summary"),
    differentiation_hint: text("differentiation_hint"),
    competitor_archetype: text("competitor_archetype"),
    revenue_lifecycle: jsonb("revenue_lifecycle").default(sql`'{}'::jsonb`),
    marketing_strategy: jsonb("marketing_strategy").default(sql`'{}'::jsonb`),
    growth_catalyst: jsonb("growth_catalyst").default(sql`'{}'::jsonb`),
    first_product_origin: jsonb("first_product_origin").default(sql`'{}'::jsonb`),
    digital_footprint: jsonb("digital_footprint").default(sql`'{}'::jsonb`),
    source_url: text("source_url"),
    researched_at: timestamp("researched_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_competitors_run").on(t.validation_run_id),
    index("idx_competitors_rank").on(t.validation_run_id, t.rank),
  ],
);

export const validationProsCons = pgTable(
  "validation_pros_cons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_run_id: uuid("validation_run_id")
      .notNull()
      .references(() => validationRuns.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    text: text("text").notNull(),
    weight: text("weight").default("medium"),
    explanation: text("explanation"),
    sort_order: integer("sort_order").default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_pros_cons_run").on(t.validation_run_id)],
);

export const validationOpportunities = pgTable(
  "validation_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_run_id: uuid("validation_run_id")
      .notNull()
      .references(() => validationRuns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    impact: text("impact").notNull(),
    how_to_capture: text("how_to_capture"),
    relevant_path: text("relevant_path").default("all"),
    sort_order: integer("sort_order").default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_opportunities_run").on(t.validation_run_id)],
);

export const validationRisks = pgTable(
  "validation_risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_run_id: uuid("validation_run_id")
      .notNull()
      .references(() => validationRuns.id, { onDelete: "cascade" }),
    risk_type: text("risk_type").notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull(),
    mitigation: text("mitigation"),
    blocks_launch: boolean("blocks_launch").notNull().default(false),
    sort_order: integer("sort_order").default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_risks_run").on(t.validation_run_id)],
);

export const validationPaths = pgTable(
  "validation_paths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validation_run_id: uuid("validation_run_id")
      .notNull()
      .references(() => validationRuns.id, { onDelete: "cascade" }),
    path_type: text("path_type").notNull(),
    label: text("label").notNull(),
    is_recommended: boolean("is_recommended").notNull().default(false),
    description: text("description").notNull(),
    tagline: text("tagline"),
    success_potential: text("success_potential").notNull(),
    estimated_outcome: text("estimated_outcome").notNull(),
    time_to_traction: text("time_to_traction").notNull(),
    key_adjustments: jsonb("key_adjustments").default(sql`'[]'::jsonb`),
    milestones: jsonb("milestones").default(sql`'[]'::jsonb`),
    path_specific_risks: jsonb("path_specific_risks").default(sql`'[]'::jsonb`),
    path_rationale: text("path_rationale"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_paths_run").on(t.validation_run_id),
    uniqueIndex("idx_paths_run_type").on(t.validation_run_id, t.path_type),
  ],
);

export const validationBhudhiResearchLog = pgTable("validation_bhudhi_research_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  validation_run_id: uuid("validation_run_id")
    .notNull()
    .references(() => validationRuns.id, { onDelete: "cascade" }),
  research_phase: text("research_phase").notNull(),
  search_query: text("search_query").notNull(),
  search_results_count: integer("search_results_count"),
  extracted_insights: jsonb("extracted_insights").default(sql`'{}'::jsonb`),
  sources: jsonb("sources").default(sql`'[]'::jsonb`),
  tokens_used: integer("tokens_used"),
  latency_ms: integer("latency_ms"),
  status: text("status"),
  error: text("error"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
