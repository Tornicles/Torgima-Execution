/**
 * PROMPT 9 — Public profile accountability tables (GROUP 24).
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users, principles, dailyPrincipleRecords } from "./tables.js";

export const publicProfileViews = pgTable("public_profile_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  viewer_id: uuid("viewer_id").references(() => users.id, { onDelete: "set null" }),
  viewed_at: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  referrer_source: text("referrer_source").notNull().default("direct"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shareableDailyEntries = pgTable(
  "shareable_daily_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entry_date: text("entry_date").notNull(),
    principle_id: uuid("principle_id").references(() => principles.id, { onDelete: "set null" }),
    daily_record_id: uuid("daily_record_id").references(() => dailyPrincipleRecords.id, {
      onDelete: "cascade",
    }),
    share_token: text("share_token").notNull().unique(),
    is_public: boolean("is_public").notNull().default(true),
    view_count: integer("view_count").notNull().default(0),
    reaction_count: integer("reaction_count").notNull().default(0),
    last_viewed_at: timestamp("last_viewed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uniq_shareable_daily_entries_user_date").on(t.user_id, t.entry_date),
    index("idx_shareable_daily_entries_token").on(t.share_token),
  ],
);

export const profileWidgets = pgTable(
  "profile_widgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    widget_type: text("widget_type").notNull(),
    embed_code: text("embed_code").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_profile_widgets_user_type").on(t.user_id, t.widget_type)],
);

export const accountabilityPledges = pgTable("accountability_pledges", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pledge_text: text("pledge_text").notNull(),
  deadline: text("deadline").notNull(),
  is_public: boolean("is_public").notNull().default(true),
  status: text("status").notNull().default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profileSocialLinks = pgTable(
  "profile_social_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    url: text("url").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_profile_social_links_user_platform").on(t.user_id, t.platform)],
);
