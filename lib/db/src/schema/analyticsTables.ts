/**
 * PROMPT 7 — Analytics tables (GROUP 22).
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, orders, principles } from "./tables";

export const executionAnalytics = pgTable(
  "execution_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric_date: text("metric_date").notNull(),
    total_orders_created: integer("total_orders_created").notNull().default(0),
    total_orders_completed: integer("total_orders_completed").notNull().default(0),
    completion_rate: doublePrecision("completion_rate").notNull().default(0),
    partial_completions: integer("partial_completions").notNull().default(0),
    failed_orders: integer("failed_orders").notNull().default(0),
    skipped_orders: integer("skipped_orders").notNull().default(0),
    average_order_score: doublePrecision("average_order_score"),
    average_time_to_complete: integer("average_time_to_complete"),
    orders_completed_on_time: integer("orders_completed_on_time").notNull().default(0),
    orders_completed_late: integer("orders_completed_late").notNull().default(0),
    execution_momentum: doublePrecision("execution_momentum").notNull().default(0),
    condition_distribution: jsonb("condition_distribution").notNull().default(sql`'{}'::jsonb`),
    peak_productivity_hour: integer("peak_productivity_hour"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_execution_analytics_user_date").on(t.user_id, t.metric_date)],
);

export const executionVelocity = pgTable("execution_velocity", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  window_start_date: text("window_start_date").notNull(),
  window_end_date: text("window_end_date").notNull(),
  window_type: text("window_type").notNull().default("daily"),
  orders_completed: integer("orders_completed").notNull().default(0),
  orders_per_day: doublePrecision("orders_per_day").notNull().default(0),
  trend: text("trend").notNull().default("stable"),
  trend_percentage: doublePrecision("trend_percentage").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const executionPatterns = pgTable("execution_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pattern_type: text("pattern_type").notNull(),
  pattern_description: text("pattern_description").notNull(),
  frequency: integer("frequency").notNull().default(0),
  impact: doublePrecision("impact").notNull().default(0),
  detected_at: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  actionable_insight: text("actionable_insight"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const failureAnalysis = pgTable("failure_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  failed_order_id: uuid("failed_order_id").references(() => orders.id, { onDelete: "set null" }),
  failure_reason: text("failure_reason"),
  failure_category: text("failure_category"),
  severity: integer("severity").notNull().default(3),
  pattern_count: integer("pattern_count").notNull().default(1),
  prediction_confidence: doublePrecision("prediction_confidence").notNull().default(0.5),
  suggested_prevention: text("suggested_prevention"),
  analyzed_at: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productivityHeatmap = pgTable(
  "productivity_heatmap",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day_of_week: integer("day_of_week").notNull(),
    hour_of_day: integer("hour_of_day").notNull(),
    orders_completed: integer("orders_completed").notNull().default(0),
    completion_rate: doublePrecision("completion_rate").notNull().default(0),
    average_score: doublePrecision("average_score"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_productivity_heatmap").on(t.user_id, t.day_of_week, t.hour_of_day)],
);

export const executionBenchmarks = pgTable(
  "execution_benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric_name: text("metric_name").notNull(),
    current_value: doublePrecision("current_value").notNull().default(0),
    personal_best: doublePrecision("personal_best"),
    personal_worst: doublePrecision("personal_worst"),
    average_value: doublePrecision("average_value"),
    trend: text("trend").notNull().default("stable"),
    days_to_beat_record: integer("days_to_beat_record"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_execution_benchmark").on(t.user_id, t.metric_name)],
);

export const principleAnalytics = pgTable("principle_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  principle_id: uuid("principle_id").references(() => principles.id, { onDelete: "set null" }),
  metric_date: text("metric_date").notNull(),
  applied_today: boolean("applied_today").notNull().default(false),
  streak_count: integer("streak_count").notNull().default(0),
  proof_submitted: boolean("proof_submitted").notNull().default(false),
  content_published: boolean("content_published").notNull().default(false),
  content_platforms: integer("content_platforms").notNull().default(0),
  total_engagement: integer("total_engagement").notNull().default(0),
  correlation_to_execution: doublePrecision("correlation_to_execution"),
  applied_count: integer("applied_count").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const principleEffectiveness = pgTable(
  "principle_effectiveness",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    principle_id: uuid("principle_id")
      .notNull()
      .references(() => principles.id, { onDelete: "cascade" }),
    effectiveness_score: doublePrecision("effectiveness_score").notNull().default(50),
    application_count: integer("application_count").notNull().default(0),
    average_order_score_when_applied: doublePrecision("average_order_score_when_applied"),
    average_order_score_when_not_applied: doublePrecision("average_order_score_when_not_applied"),
    correlation_strength: doublePrecision("correlation_strength").notNull().default(0),
    trend: text("trend").notNull().default("stable"),
    last_evaluated_at: timestamp("last_evaluated_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_principle_effectiveness").on(t.user_id, t.principle_id)],
);

export const principleInsights = pgTable("principle_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  principle_id: uuid("principle_id").references(() => principles.id, { onDelete: "set null" }),
  insight_type: text("insight_type").notNull(),
  insight_text: text("insight_text").notNull(),
  confidence: doublePrecision("confidence").notNull().default(0.7),
  actionable_recommendation: text("actionable_recommendation"),
  detected_at: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyAnalytics = pgTable(
  "academy_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric_date: text("metric_date").notNull(),
    courses_in_progress: integer("courses_in_progress").notNull().default(0),
    courses_completed: integer("courses_completed").notNull().default(0),
    lessons_completed: integer("lessons_completed").notNull().default(0),
    average_lesson_score: doublePrecision("average_lesson_score"),
    total_study_time_minutes: integer("total_study_time_minutes").notNull().default(0),
    concepts_mastered: integer("concepts_mastered").notNull().default(0),
    concepts_weak: integer("concepts_weak").notNull().default(0),
    average_practice_score: doublePrecision("average_practice_score"),
    retry_count: integer("retry_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_academy_analytics_user_date").on(t.user_id, t.metric_date)],
);

export const learningVelocityAnalytics = pgTable("learning_velocity_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  window_start_date: text("window_start_date").notNull(),
  window_end_date: text("window_end_date").notNull(),
  window_type: text("window_type").notNull().default("weekly"),
  lessons_completed: integer("lessons_completed").notNull().default(0),
  hours_studied: doublePrecision("hours_studied").notNull().default(0),
  concepts_mastered: integer("concepts_mastered").notNull().default(0),
  velocity_trend: text("velocity_trend").notNull().default("stable"),
  estimated_completion_date: text("estimated_completion_date"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weakAreasDetected = pgTable("weak_areas_detected", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  concept_id: text("concept_id").notNull(),
  weakness_description: text("weakness_description").notNull(),
  mastery_level: doublePrecision("mastery_level").notNull().default(0),
  attempts_failed: integer("attempts_failed").notNull().default(0),
  common_mistake: text("common_mistake"),
  recommended_action: text("recommended_action"),
  detected_at: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentAnalytics = pgTable(
  "content_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric_date: text("metric_date").notNull(),
    posts_published: integer("posts_published").notNull().default(0),
    total_engagement: integer("total_engagement").notNull().default(0),
    average_engagement_per_post: doublePrecision("average_engagement_per_post").notNull().default(0),
    total_reach: integer("total_reach").notNull().default(0),
    total_impressions: integer("total_impressions").notNull().default(0),
    audience_growth_percent: doublePrecision("audience_growth_percent").notNull().default(0),
    best_performing_content_id: uuid("best_performing_content_id"),
    best_performing_platform: text("best_performing_platform"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_content_analytics_user_date").on(t.user_id, t.metric_date)],
);

export const platformPerformance = pgTable(
  "platform_performance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    metric_date: text("metric_date").notNull(),
    posts_published: integer("posts_published").notNull().default(0),
    total_engagement: integer("total_engagement").notNull().default(0),
    total_reach: integer("total_reach").notNull().default(0),
    total_impressions: integer("total_impressions").notNull().default(0),
    average_engagement_rate: doublePrecision("average_engagement_rate").notNull().default(0),
    top_post_engagement: integer("top_post_engagement").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_platform_performance").on(t.user_id, t.platform, t.metric_date)],
);

export const postPerformance = pgTable(
  "post_performance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    principle_id: uuid("principle_id").references(() => principles.id, { onDelete: "set null" }),
    post_id: text("post_id").notNull(),
    platform: text("platform").notNull(),
    title: text("title"),
    content_summary: text("content_summary"),
    published_at: timestamp("published_at", { withTimezone: true }),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    retweets: integer("retweets").notNull().default(0),
    views: integer("views").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    engagement_rate: doublePrecision("engagement_rate").notNull().default(0),
    virality_score: doublePrecision("virality_score").notNull().default(0),
    audience_segment_reached: jsonb("audience_segment_reached").notNull().default(sql`'[]'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("uniq_post_performance").on(t.user_id, t.post_id, t.platform)],
);

export const contentInsights = pgTable("content_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  insight_type: text("insight_type").notNull(),
  insight_text: text("insight_text").notNull(),
  confidence: doublePrecision("confidence").notNull().default(0.7),
  actionable_recommendation: text("actionable_recommendation"),
  detected_at: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsInsights = pgTable("analytics_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  insights: jsonb("insights").notNull().default(sql`'[]'::jsonb`),
  generated_at: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
