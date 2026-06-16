/**
 * DOC27 — external signal types, constants, and routing targets.
 */

export const EXTERNAL_SIGNAL_TYPES = [
  "user_upload",
  "external_link",
  "approved_webhook",
  "internal_metric",
  "manual_confirmation",
] as const;

export type ExternalSignalType = (typeof EXTERNAL_SIGNAL_TYPES)[number];

export type ExternalTrustLevel = "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";

export const TRUSTED_DOMAINS = [
  "stripe.com",
  "paypal.com",
  "github.com",
  "notion.so",
  "google.com/analytics",
  "shopify.com",
  "gumroad.com",
  "calendly.com",
  "typeform.com",
  "loom.com",
] as const;

export const APPROVED_WEBHOOK_SOURCES = ["stripe", "github", "calendly"] as const;

export type ApprovedWebhookSource = (typeof APPROVED_WEBHOOK_SOURCES)[number];

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_UPLOAD_BYTES = 10_000_000;

export const ROUTING_TARGETS: Record<ExternalSignalType, string> = {
  user_upload: "EvidenceLedgerService",
  external_link: "EvidenceLedgerService",
  approved_webhook: "OutcomeValidationEngine|DependencyEngine",
  internal_metric: "SignalEngine",
  manual_confirmation: "OutcomeValidationEngine",
};

export type TrustScore = {
  level: ExternalTrustLevel;
  score: number;
};

export type UploadContext = {
  blueprintId: string;
  taskId?: string;
  academyTaskId?: string;
  description?: string;
};

export type UploadFileInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

export type ExternalLinkInput = {
  url: string;
  description?: string;
  blueprintId: string;
  taskId?: string;
};
