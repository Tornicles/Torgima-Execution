/**
 * PROMPT 8 — Shared integration types for api-server and clients.
 */
export const INTEGRATION_TYPES = [
  "google-calendar",
  "apple-calendar",
  "apple-health",
  "google-fit",
  "slack",
  "discord",
  "telegram",
  "linkedin",
  "twitter",
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
] as const;

export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export const NOTIFICATION_INTEGRATION_TYPES = ["slack", "discord", "telegram"] as const;

export const WEBHOOK_EVENT_TYPES = [
  "order-completed",
  "feedback-submitted",
  "principle-applied",
  "course-completed",
  "goal-achieved",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WIDGET_TYPES = [
  "streak-counter",
  "level-badge",
  "accountability-card",
  "principle-record",
] as const;
