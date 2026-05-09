// Notification taxonomy — the union of every notification the system can emit.
// Frequency caps and default user preferences live here so the
// NotificationWorker (Prompt 13+) and any front-end preference UI share a
// single source of truth.
//
// Spec: Prompt 1 §constants/notifications. Mirrors the seeded
// `users.notification_preferences` JSONB default.

export const NOTIFICATION_TYPES = {
  INACTIVITY_REMINDER:           "inactivity_reminder",
  MILESTONE_ACHIEVED:            "milestone_achieved",
  BLUEPRINT_COMPLETED:           "blueprint_completed",
  PIVOT_REVIEW_READY:            "pivot_review_ready",
  BLUEPRINT_PAUSED_CONFIRMATION: "blueprint_paused_confirmation",
  WEEKLY_SUMMARY:                "weekly_summary",
  MAGIC_LINK_AUTH:               "magic_link_auth",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// Hours between two consecutive sends for the same notification type per user.
// 0 means no cap (one-shot notifications fire whenever they're scheduled).
export const FREQUENCY_CAP_HOURS: Record<NotificationType, number> = {
  inactivity_reminder:           24,
  milestone_achieved:            0,
  blueprint_completed:           0,
  pivot_review_ready:            0,
  blueprint_paused_confirmation: 0,
  weekly_summary:                168,
  magic_link_auth:               0,
};

export interface NotificationPreferences {
  email_inactivity_reminder:    boolean;
  email_milestone_achieved:     boolean;
  email_blueprint_completed:    boolean;
  email_pivot_review_ready:     boolean;
  email_blueprint_paused:       boolean;
  email_weekly_summary:         boolean;
  email_all_disabled:           boolean;
  quiet_hours_enabled:          boolean;
  quiet_hours_start:            string;
  quiet_hours_end:              string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email_inactivity_reminder:    true,
  email_milestone_achieved:     true,
  email_blueprint_completed:    true,
  email_pivot_review_ready:     true,
  email_blueprint_paused:       true,
  email_weekly_summary:         false,
  email_all_disabled:           false,
  quiet_hours_enabled:          false,
  quiet_hours_start:            "22:00",
  quiet_hours_end:              "08:00",
};
