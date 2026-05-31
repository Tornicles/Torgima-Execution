-- Final production alignment — idempotent column adds across execution chain
-- Tracked by _manual_migration_ledger via apply-all-manual-migrations.mjs

-- BLUEPRINTS
ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS raw_purpose TEXT,
  ADD COLUMN IF NOT EXISTS economic_type TEXT,
  ADD COLUMN IF NOT EXISTS goal_options JSONB,
  ADD COLUMN IF NOT EXISTS selected_goal_index INTEGER,
  ADD COLUMN IF NOT EXISTS purpose_options JSONB,
  ADD COLUMN IF NOT EXISTS selected_purpose_index INTEGER,
  ADD COLUMN IF NOT EXISTS goal_final TEXT,
  ADD COLUMN IF NOT EXISTS purpose_final TEXT,
  ADD COLUMN IF NOT EXISTS refinement_status TEXT,
  ADD COLUMN IF NOT EXISTS blueprint_tier TEXT,
  ADD COLUMN IF NOT EXISTS industry_state JSONB,
  ADD COLUMN IF NOT EXISTS archetype_execution_mult NUMERIC,
  ADD COLUMN IF NOT EXISTS archetype_timeframe_mult NUMERIC,
  ADD COLUMN IF NOT EXISTS archetype_difficulty_adj NUMERIC,
  ADD COLUMN IF NOT EXISTS chosen_blueprint_level TEXT,
  ADD COLUMN IF NOT EXISTS economy_briefing_summary TEXT,
  ADD COLUMN IF NOT EXISTS erector_validation_id TEXT,
  ADD COLUMN IF NOT EXISTS primary_archetype_id TEXT,
  ADD COLUMN IF NOT EXISTS reality_score NUMERIC,
  ADD COLUMN IF NOT EXISTS operational_state TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS current_domain TEXT,
  ADD COLUMN IF NOT EXISTS domain_hint TEXT,
  ADD COLUMN IF NOT EXISTS intel_metadata JSONB,
  ADD COLUMN IF NOT EXISTS intelligence_payload JSONB,
  ADD COLUMN IF NOT EXISTS current_sequence_number INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sequences_completed_numbers INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tier_sequence_gates JSONB,
  ADD COLUMN IF NOT EXISTS sequence_audit_log JSONB,
  ADD COLUMN IF NOT EXISTS last_sequence_update TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS launched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_target_id TEXT,
  ADD COLUMN IF NOT EXISTS current_action_id TEXT;

-- VALIDATIONS
ALTER TABLE validations
  ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_package JSONB,
  ADD COLUMN IF NOT EXISTS selected_path TEXT,
  ADD COLUMN IF NOT EXISTS selected_path_type TEXT,
  ADD COLUMN IF NOT EXISTS validation_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS launch_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS readiness JSONB,
  ADD COLUMN IF NOT EXISTS contract_id TEXT,
  ADD COLUMN IF NOT EXISTS intelligence_payload JSONB,
  ADD COLUMN IF NOT EXISTS blueprint_contract JSONB,
  ADD COLUMN IF NOT EXISTS paths JSONB,
  ADD COLUMN IF NOT EXISTS verdict TEXT,
  ADD COLUMN IF NOT EXISTS reality_result JSONB,
  ADD COLUMN IF NOT EXISTS selected_direction JSONB,
  ADD COLUMN IF NOT EXISTS economic_context JSONB,
  ADD COLUMN IF NOT EXISTS enriched_competitors JSONB,
  ADD COLUMN IF NOT EXISTS enriched_opportunities JSONB,
  ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_url TEXT,
  ADD COLUMN IF NOT EXISTS raw_goal TEXT,
  ADD COLUMN IF NOT EXISTS raw_purpose TEXT,
  ADD COLUMN IF NOT EXISTS goal_options JSONB,
  ADD COLUMN IF NOT EXISTS purpose_options JSONB,
  ADD COLUMN IF NOT EXISTS goal_understanding JSONB,
  ADD COLUMN IF NOT EXISTS purpose_understanding JSONB,
  ADD COLUMN IF NOT EXISTS selected_goal TEXT,
  ADD COLUMN IF NOT EXISTS selected_purpose TEXT,
  ADD COLUMN IF NOT EXISTS risk_flags JSONB,
  ADD COLUMN IF NOT EXISTS refinement_status TEXT,
  ADD COLUMN IF NOT EXISTS payload_version INTEGER DEFAULT 1;

-- ORDERS
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS linked_action_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_project_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_phase_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_target_id TEXT,
  ADD COLUMN IF NOT EXISTS why_it_matters TEXT,
  ADD COLUMN IF NOT EXISTS enforcement_package_id TEXT,
  ADD COLUMN IF NOT EXISTS generation_mode TEXT,
  ADD COLUMN IF NOT EXISTS value_score NUMERIC DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS feedback_id TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS milestone_reference TEXT;

-- FEEDBACK
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS weighted_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_weight NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS requires_interrogation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS interrogation_question TEXT,
  ADD COLUMN IF NOT EXISTS interrogation_answer TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS had_blocker BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocker_type TEXT,
  ADD COLUMN IF NOT EXISTS blocker_details TEXT,
  ADD COLUMN IF NOT EXISTS difficulty_felt TEXT,
  ADD COLUMN IF NOT EXISTS completion TEXT,
  ADD COLUMN IF NOT EXISTS proof_json JSONB,
  ADD COLUMN IF NOT EXISTS order_id TEXT,
  ADD COLUMN IF NOT EXISTS blueprint_id TEXT;

-- SIGNAL_SNAPSHOTS
ALTER TABLE signal_snapshots
  ADD COLUMN IF NOT EXISTS data_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trend TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trigger_feedback_id TEXT,
  ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'insufficient_data';

-- CONDITION_RECORDS
ALTER TABLE condition_records
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS task_limit_min INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS task_limit_max INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS difficulty_cap TEXT DEFAULT 'easy';

-- STATE_MEMORY
ALTER TABLE state_memory
  ADD COLUMN IF NOT EXISTS exited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_id TEXT;

-- TASK_GENERATION_LOGS
CREATE TABLE IF NOT EXISTS task_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id TEXT,
  user_id TEXT,
  trigger TEXT,
  tasks_generated INTEGER DEFAULT 0,
  generation_mode TEXT,
  condition TEXT,
  bhudhi_used BOOLEAN DEFAULT false,
  failure_reason TEXT,
  enforcement_package_id TEXT,
  order_ids JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PLANS
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS blueprint_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_type TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- TARGETS
ALTER TABLE targets
  ADD COLUMN IF NOT EXISTS blueprint_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS metric TEXT,
  ADD COLUMN IF NOT EXISTS expected_value TEXT,
  ADD COLUMN IF NOT EXISTS current_value TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- PHASES
ALTER TABLE phases
  ADD COLUMN IF NOT EXISTS blueprint_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS target_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS phase_type TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- PROJECTS
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS blueprint_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS phase_id TEXT,
  ADD COLUMN IF NOT EXISTS target_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS project_type TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ACTIONS
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS blueprint_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS phase_id TEXT,
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS target_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS instruction TEXT,
  ADD COLUMN IF NOT EXISTS expected_output TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS knowledge_category TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- EVENTS
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS events_idempotency_key_idx
  ON events(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- DEAD LETTER EVENTS
CREATE TABLE IF NOT EXISTS dead_letter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  entity_type TEXT,
  entity_id TEXT,
  user_id TEXT,
  blueprint_id TEXT,
  payload JSONB,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  original_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
