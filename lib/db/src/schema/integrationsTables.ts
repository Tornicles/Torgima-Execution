/**
 * PROMPT 8 — External integrations (GROUP 23).
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
import { users, calendarEvents, publishedContent } from "./tables.js";

export const externalIntegrations = pgTable(
  "external_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    integration_type: text("integration_type").notNull(),
    is_connected: boolean("is_connected").notNull().default(false),
    oauth_token_encrypted: text("oauth_token_encrypted"),
    oauth_refresh_token_encrypted: text("oauth_refresh_token_encrypted"),
    oauth_scope: jsonb("oauth_scope").notNull().default(sql`'[]'::jsonb`),
    account_identifier: text("account_identifier"),
    last_sync_time: timestamp("last_sync_time", { withTimezone: true }),
    last_sync_status: text("last_sync_status").notNull().default("pending"),
    last_sync_error: text("last_sync_error"),
    sync_frequency: text("sync_frequency").notNull().default("hourly"),
    enabled: boolean("enabled").notNull().default(true),
    connected_at: timestamp("connected_at", { withTimezone: true }),
    disconnected_at: timestamp("disconnected_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_external_integrations_user_type").on(t.user_id, t.integration_type)],
);

export const calendarSyncLog = pgTable("calendar_sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  integration_id: uuid("integration_id")
    .notNull()
    .references(() => externalIntegrations.id, { onDelete: "cascade" }),
  sync_direction: text("sync_direction").notNull(),
  events_synced: integer("events_synced").notNull().default(0),
  events_created: integer("events_created").notNull().default(0),
  events_updated: integer("events_updated").notNull().default(0),
  events_deleted: integer("events_deleted").notNull().default(0),
  sync_timestamp: timestamp("sync_timestamp", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("success"),
  error_details: text("error_details"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const healthDataSyncLog = pgTable("health_data_sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  integration_id: uuid("integration_id").references(() => externalIntegrations.id, {
    onDelete: "set null",
  }),
  metric_type: text("metric_type").notNull(),
  value: doublePrecision("value").notNull(),
  unit: text("unit").notNull(),
  source_date: text("source_date").notNull(),
  synced_at: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calendarConflictsExternal = pgTable("calendar_conflicts_external", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  torgima_event_id: uuid("torgima_event_id").references(() => calendarEvents.id, {
    onDelete: "cascade",
  }),
  external_event_id: text("external_event_id").notNull(),
  external_calendar: text("external_calendar").notNull(),
  conflict_type: text("conflict_type").notNull().default("time-overlap"),
  resolution_strategy: text("resolution_strategy").notNull().default("manual"),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialPostMappings = pgTable("social_post_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  published_content_id: uuid("published_content_id").references(() => publishedContent.id, {
    onDelete: "set null",
  }),
  platform: text("platform").notNull(),
  external_post_id: text("external_post_id"),
  external_post_url: text("external_post_url"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engagementSyncLog = pgTable("engagement_sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  social_post_mapping_id: uuid("social_post_mapping_id")
    .notNull()
    .references(() => socialPostMappings.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  views: integer("views").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  engagement_rate: doublePrecision("engagement_rate").notNull().default(0),
  synced_at: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const integrationWebhooks = pgTable("integration_webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  webhook_url: text("webhook_url").notNull(),
  event_type: text("event_type").notNull(),
  secret: text("secret"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const integrationWebhookLogs = pgTable("integration_webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhook_id: uuid("webhook_id")
    .notNull()
    .references(() => integrationWebhooks.id, { onDelete: "cascade" }),
  event_type: text("event_type").notNull(),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  delivery_status: text("delivery_status").notNull().default("pending"),
  retry_count: integer("retry_count").notNull().default(0),
  response_status: integer("response_status"),
  response_body: text("response_body"),
  delivered_at: timestamp("delivered_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automationFlows = pgTable("automation_flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull(),
  trigger_conditions: jsonb("trigger_conditions").notNull().default(sql`'{}'::jsonb`),
  actions: jsonb("actions").notNull().default(sql`'[]'::jsonb`),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const zapierConnections = pgTable(
  "zapier_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    zapier_id: text("zapier_id").notNull(),
    integration_type: text("integration_type").notNull(),
    is_active: boolean("is_active").notNull().default(true),
    connected_at: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_zapier_connections_user_zapier").on(t.user_id, t.zapier_id)],
);
