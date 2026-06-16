-- ERECTOR SCHEMA 3 — Governance & Operations
-- Requires Schema 1 (0042/0043) and Schema 2 (0044/0045) applied first.

-- PART 1 — decision audits
CREATE TABLE IF NOT EXISTS erector_decision_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT NOT NULL UNIQUE,
  decision_type TEXT NOT NULL,
  source_engine TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  blueprint_id UUID REFERENCES blueprints(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  signal_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  rules_applied TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  framework_verdicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  result TEXT NOT NULL,
  result_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation_id UUID,
  downstream_effects TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  user_visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_decision_audits_user ON erector_decision_audits(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_decision_audits_blueprint ON erector_decision_audits(blueprint_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_decision_audits_type ON erector_decision_audits(decision_type);
--> statement-breakpoint

-- PART 1 — model versions (seeded in 0047)
CREATE TABLE IF NOT EXISTS erector_model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL UNIQUE,
  current_version TEXT NOT NULL,
  previous_version TEXT,
  changelog TEXT,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- PART 2 — user-facing explanations
CREATE TABLE IF NOT EXISTS erector_user_facing_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_audit_id TEXT REFERENCES erector_decision_audits(decision_id),
  user_id UUID NOT NULL REFERENCES users(id),
  user_facing_summary TEXT NOT NULL,
  plain_language_reason TEXT NOT NULL,
  evidence_used TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  missing_evidence TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  blocker_type TEXT,
  correction_required TEXT,
  what_is_not_judged TEXT NOT NULL DEFAULT 'This does not judge your commitment or effort. It evaluates your plan, context, and evidence.',
  next_allowed_action TEXT,
  next_blocked_action TEXT,
  confidence_label TEXT NOT NULL DEFAULT 'Based on the information provided',
  generated_by_bhudhi BOOLEAN NOT NULL DEFAULT true,
  bhudhi_log_id UUID,
  passed_explanation_contract BOOLEAN NOT NULL DEFAULT false,
  shown_to_user BOOLEAN NOT NULL DEFAULT false,
  shown_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_explanations_user ON erector_user_facing_explanations(user_id);
--> statement-breakpoint

-- PART 3 — integrity flags
CREATE TABLE IF NOT EXISTS erector_integrity_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id),
  evidence_id UUID REFERENCES erector_evidence_ledger(id),
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'LOW',
  detection_reason TEXT NOT NULL,
  auto_action_taken TEXT,
  confidence_impact NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  review_outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_integrity_flags_user ON erector_integrity_flags(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_integrity_flags_status ON erector_integrity_flags(status);
--> statement-breakpoint

-- PART 4 — manual review cases
CREATE TABLE IF NOT EXISTS erector_manual_review_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  blueprint_id UUID REFERENCES blueprints(id),
  trigger_type TEXT NOT NULL,
  trigger_description TEXT NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  integrity_flag_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  decision_audit_id TEXT REFERENCES erector_decision_audits(decision_id),
  risk_level TEXT NOT NULL DEFAULT 'MEDIUM',
  assigned_reviewer TEXT,
  assigned_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  final_resolution TEXT,
  resolution_notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  audit_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_manual_review_user ON erector_manual_review_cases(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_manual_review_status ON erector_manual_review_cases(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_manual_review_risk ON erector_manual_review_cases(risk_level);
--> statement-breakpoint

-- PART 5 — system error records
CREATE TABLE IF NOT EXISTS erector_system_error_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  source_engine TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  blueprint_id UUID REFERENCES blueprints(id),
  entity_type TEXT,
  entity_id TEXT,
  error_message TEXT NOT NULL,
  error_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  recovery_action TEXT,
  recovery_status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_system_errors_type ON erector_system_error_records(error_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_system_errors_recovery ON erector_system_error_records(recovery_status);
--> statement-breakpoint

-- PART 6 — observability logs
CREATE TABLE IF NOT EXISTS erector_observability_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL,
  run_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  blueprint_id UUID REFERENCES blueprints(id),
  latency_ms INTEGER,
  verdict_issued TEXT,
  user_accepted_verdict BOOLEAN,
  false_positive_flag BOOLEAN NOT NULL DEFAULT false,
  false_negative_flag BOOLEAN NOT NULL DEFAULT false,
  bhudhi_called BOOLEAN NOT NULL DEFAULT false,
  bhudhi_fallback_used BOOLEAN NOT NULL DEFAULT false,
  bhudhi_tokens_used INTEGER,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_observability_run_type ON erector_observability_logs(run_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_observability_user ON erector_observability_logs(user_id);
