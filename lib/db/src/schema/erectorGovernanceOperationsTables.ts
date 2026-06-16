/**
 * ERECTOR SCHEMA 3 — Governance & Operations tables.
 * Audit trail, explanations, integrity, manual review, errors, observability.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { blueprints, users } from "./tables.js";
import { erectorEvidenceLedger } from "./erectorCoreRuntimeTables.js";

export const erectorDecisionAudits = pgTable(
  "erector_decision_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decision_id: text("decision_id").notNull().unique(),
    decision_type: text("decision_type").notNull(),
    source_engine: text("source_engine").notNull(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    entity_type: text("entity_type").notNull(),
    entity_id: text("entity_id").notNull(),
    input_snapshot: jsonb("input_snapshot").notNull().default(sql`'{}'::jsonb`),
    evidence_ids: text("evidence_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    signal_ids: text("signal_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    rules_applied: text("rules_applied").array().notNull().default(sql`ARRAY[]::text[]`),
    framework_verdicts: jsonb("framework_verdicts").notNull().default(sql`'[]'::jsonb`),
    model_versions: jsonb("model_versions").notNull().default(sql`'{}'::jsonb`),
    result: text("result").notNull(),
    result_detail: jsonb("result_detail").notNull().default(sql`'{}'::jsonb`),
    explanation_id: uuid("explanation_id"),
    downstream_effects: text("downstream_effects").array().notNull().default(sql`ARRAY[]::text[]`),
    user_visible: boolean("user_visible").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_decision_audits_user").on(t.user_id),
    index("idx_decision_audits_blueprint").on(t.blueprint_id),
    index("idx_decision_audits_type").on(t.decision_type),
  ],
);

export const erectorModelVersions = pgTable("erector_model_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  component: text("component").notNull().unique(),
  current_version: text("current_version").notNull(),
  previous_version: text("previous_version"),
  changelog: text("changelog"),
  activated_at: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  activated_by: text("activated_by").notNull().default("system"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const erectorUserFacingExplanations = pgTable(
  "erector_user_facing_explanations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decision_audit_id: text("decision_audit_id").references(() => erectorDecisionAudits.decision_id),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id),
    user_facing_summary: text("user_facing_summary").notNull(),
    plain_language_reason: text("plain_language_reason").notNull(),
    evidence_used: text("evidence_used").array().notNull().default(sql`ARRAY[]::text[]`),
    missing_evidence: text("missing_evidence").array().notNull().default(sql`ARRAY[]::text[]`),
    blocker_type: text("blocker_type"),
    correction_required: text("correction_required"),
    what_is_not_judged: text("what_is_not_judged")
      .notNull()
      .default(
        "This does not judge your commitment or effort. It evaluates your plan, context, and evidence.",
      ),
    next_allowed_action: text("next_allowed_action"),
    next_blocked_action: text("next_blocked_action"),
    confidence_label: text("confidence_label").notNull().default("Based on the information provided"),
    generated_by_bhudhi: boolean("generated_by_bhudhi").notNull().default(true),
    bhudhi_log_id: uuid("bhudhi_log_id"),
    passed_explanation_contract: boolean("passed_explanation_contract").notNull().default(false),
    shown_to_user: boolean("shown_to_user").notNull().default(false),
    shown_at: timestamp("shown_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_explanations_user").on(t.user_id)],
);

export const erectorIntegrityFlags = pgTable(
  "erector_integrity_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    evidence_id: uuid("evidence_id").references(() => erectorEvidenceLedger.id),
    flag_type: text("flag_type").notNull(),
    severity: text("severity").notNull().default("LOW"),
    detection_reason: text("detection_reason").notNull(),
    auto_action_taken: text("auto_action_taken"),
    confidence_impact: numeric("confidence_impact", { precision: 3, scale: 2 })
      .notNull()
      .default("0.00"),
    status: text("status").notNull().default("open"),
    reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
    reviewed_by: text("reviewed_by"),
    review_outcome: text("review_outcome"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_integrity_flags_user").on(t.user_id),
    index("idx_integrity_flags_status").on(t.status),
  ],
);

export const erectorManualReviewCases = pgTable(
  "erector_manual_review_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    case_id: text("case_id").notNull().unique(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    trigger_type: text("trigger_type").notNull(),
    trigger_description: text("trigger_description").notNull(),
    evidence_ids: text("evidence_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    integrity_flag_ids: text("integrity_flag_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    decision_audit_id: text("decision_audit_id").references(() => erectorDecisionAudits.decision_id),
    risk_level: text("risk_level").notNull().default("MEDIUM"),
    assigned_reviewer: text("assigned_reviewer"),
    assigned_at: timestamp("assigned_at", { withTimezone: true }),
    reviewer_notes: text("reviewer_notes"),
    final_resolution: text("final_resolution"),
    resolution_notes: text("resolution_notes"),
    status: text("status").notNull().default("open"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    audit_id: uuid("audit_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_manual_review_user").on(t.user_id),
    index("idx_manual_review_status").on(t.status),
    index("idx_manual_review_risk").on(t.risk_level),
  ],
);

export const erectorSystemErrorRecords = pgTable(
  "erector_system_error_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    error_type: text("error_type").notNull(),
    source_engine: text("source_engine").notNull(),
    user_id: uuid("user_id").references(() => users.id),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    entity_type: text("entity_type"),
    entity_id: text("entity_id"),
    error_message: text("error_message").notNull(),
    error_detail: jsonb("error_detail").notNull().default(sql`'{}'::jsonb`),
    retry_count: integer("retry_count").notNull().default(0),
    max_retries: integer("max_retries").notNull().default(3),
    recovery_action: text("recovery_action"),
    recovery_status: text("recovery_status").notNull().default("pending"),
    idempotency_key: text("idempotency_key"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_system_errors_type").on(t.error_type),
    index("idx_system_errors_recovery").on(t.recovery_status),
  ],
);

export const erectorObservabilityLogs = pgTable(
  "erector_observability_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    run_type: text("run_type").notNull(),
    run_id: text("run_id").notNull(),
    user_id: uuid("user_id").references(() => users.id),
    blueprint_id: uuid("blueprint_id").references(() => blueprints.id),
    latency_ms: integer("latency_ms"),
    verdict_issued: text("verdict_issued"),
    user_accepted_verdict: boolean("user_accepted_verdict"),
    false_positive_flag: boolean("false_positive_flag").notNull().default(false),
    false_negative_flag: boolean("false_negative_flag").notNull().default(false),
    bhudhi_called: boolean("bhudhi_called").notNull().default(false),
    bhudhi_fallback_used: boolean("bhudhi_fallback_used").notNull().default(false),
    bhudhi_tokens_used: integer("bhudhi_tokens_used"),
    result_summary: jsonb("result_summary").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_observability_run_type").on(t.run_type),
    index("idx_observability_user").on(t.user_id),
  ],
);
