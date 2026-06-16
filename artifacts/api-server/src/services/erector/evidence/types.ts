import type { InferSelectModel } from "drizzle-orm";
import type { erectorEvidenceLedger } from "@workspace/db";

export type EvidenceRecord = InferSelectModel<typeof erectorEvidenceLedger>;

export type EvidenceSourceType =
  | "user_upload"
  | "external_link"
  | "payment_signal"
  | "customer_signal"
  | "analytics"
  | "external_confirmation"
  | "bhudhi_summary";

export type EvidenceClass =
  | "DIRECT_ARTIFACT"
  | "PAYMENT_PROOF"
  | "CUSTOMER_SIGNAL"
  | "ANALYTICS_MOVEMENT"
  | "EXTERNAL_CONFIRMATION"
  | "BHUDHI_SUMMARY"
  | "STRUCTURED_PROOF"
  | "USER_EXPLANATION"
  | "TASK_COMPLETION_COUNT"
  | "INTENTION_OR_PLAN";

export type EvidenceStrength =
  | "HIGH"
  | "MEDIUM-HIGH"
  | "MEDIUM"
  | "LOW-MEDIUM"
  | "LOW"
  | "NONE";

export type IntegrityFlag =
  | "SELF_REPORT_ONLY"
  | "CLAIM_EVIDENCE_MISMATCH"
  | "SUSPICIOUS_METRIC"
  | "REPEATED_LOW_VALUE";

export interface SubmitEvidenceInput {
  userId: string;
  blueprintId?: string;
  taskId?: string;
  academyTaskId?: string;
  outcomeId?: string;
  validationRunId?: string;
  sourceType: EvidenceSourceType | string;
  sourceLocation?: string;
  contentJson: Record<string, unknown>;
  contentSummary?: string;
}

export interface SubmitEvidenceResult {
  evidence_id: string;
  evidence_class: EvidenceClass;
  evidence_strength: EvidenceStrength;
  integrity_flags: IntegrityFlag[];
  rejected?: boolean;
}
