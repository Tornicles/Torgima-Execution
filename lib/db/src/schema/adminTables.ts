import { pgTable, text, timestamp, uuid, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { users } from "./tables";

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    admin_email: text("admin_email").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip_hash: text("ip_hash"),
    revoked: boolean("revoked").notNull().default(false),
  },
  (t) => [index("idx_admin_sessions_email").on(t.admin_email), index("idx_admin_sessions_expires").on(t.expires_at)],
);

export const adminSupportNotes = pgTable(
  "admin_support_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    admin_email: text("admin_email").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_admin_support_notes_user").on(t.user_id, t.created_at)],
);

export const adminActionsLog = pgTable(
  "admin_actions_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    admin_email: text("admin_email").notNull(),
    action_type: text("action_type").notNull(),
    target_user_id: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload"),
    reason: text("reason"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_admin_actions_log_created").on(t.created_at),
    index("idx_admin_actions_log_user").on(t.target_user_id),
  ],
);

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name"),
    source: text("source").notNull().default("website"),
    goal: text("goal"),
    invited: boolean("invited").notNull().default(false),
    invited_at: timestamp("invited_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_waitlist_email").on(t.email), index("idx_waitlist_invited").on(t.invited)],
);
