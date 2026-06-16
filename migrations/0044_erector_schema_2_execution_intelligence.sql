-- ERECTOR SCHEMA 2 — Execution Intelligence
-- Requires Schema 1 (0042/0043) applied first. ADD columns/tables only.

-- PART 1.1 — academy_tasks
ALTER TABLE academy_tasks ADD COLUMN IF NOT EXISTS capability_gap_id UUID;
--> statement-breakpoint
ALTER TABLE academy_tasks ADD COLUMN IF NOT EXISTS learning_type TEXT;
--> statement-breakpoint
ALTER TABLE academy_tasks ADD COLUMN IF NOT EXISTS execution_requirement TEXT;
--> statement-breakpoint
ALTER TABLE academy_tasks ADD COLUMN IF NOT EXISTS erector_evidence_id UUID;
--> statement-breakpoint

-- PART 1.2 — academy_proof
ALTER TABLE academy_proof ADD COLUMN IF NOT EXISTS evidence_ledger_id UUID;
--> statement-breakpoint
ALTER TABLE academy_proof ADD COLUMN IF NOT EXISTS evidence_class TEXT;
--> statement-breakpoint
ALTER TABLE academy_proof ADD COLUMN IF NOT EXISTS signal_validated BOOLEAN NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE academy_proof ADD COLUMN IF NOT EXISTS capability_confirmed BOOLEAN NOT NULL DEFAULT false;
--> statement-breakpoint

-- PART 1.3 — outcome_validations (target_id and evidence_score may already exist from DOC 02)
ALTER TABLE outcome_validations ADD COLUMN IF NOT EXISTS outcome_movement_score INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE outcome_validations ADD COLUMN IF NOT EXISTS archetype_false_progress_patterns TEXT[] NOT NULL DEFAULT ARRAY[]::text[];
--> statement-breakpoint
ALTER TABLE outcome_validations ADD COLUMN IF NOT EXISTS correction_path_id UUID;
--> statement-breakpoint

-- PART 1.4 — false_progress_flags
ALTER TABLE false_progress_flags ADD COLUMN IF NOT EXISTS archetype_pattern TEXT;
--> statement-breakpoint
ALTER TABLE false_progress_flags ADD COLUMN IF NOT EXISTS evidence_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[];
--> statement-breakpoint
ALTER TABLE false_progress_flags ADD COLUMN IF NOT EXISTS correction_path_id UUID;
--> statement-breakpoint
ALTER TABLE false_progress_flags ADD COLUMN IF NOT EXISTS false_progress_score INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint

-- PART 2 — capability system
CREATE TABLE IF NOT EXISTS erector_capability_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id TEXT NOT NULL UNIQUE,
  capability_name TEXT NOT NULL,
  capability_description TEXT NOT NULL,
  domain TEXT NOT NULL,
  phase_relevance TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  required_for_task_types TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  prerequisite_capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  proof_required TEXT NOT NULL,
  evidence_types_allowed TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  minimum_signal_threshold INTEGER NOT NULL DEFAULT 60,
  available_starter BOOLEAN NOT NULL DEFAULT true,
  available_growth BOOLEAN NOT NULL DEFAULT true,
  available_ultimate BOOLEAN NOT NULL DEFAULT true,
  decay_rule TEXT NOT NULL DEFAULT 'none',
  decay_threshold_days INTEGER,
  upgrade_to_capability TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_capability_graph_domain ON erector_capability_graph(domain);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS erector_capability_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id),
  task_id UUID,
  capability_id TEXT NOT NULL REFERENCES erector_capability_graph(capability_id),
  current_proof_level TEXT NOT NULL DEFAULT 'none',
  required_proof_level TEXT NOT NULL DEFAULT 'proven',
  missing_evidence TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  block_level TEXT NOT NULL DEFAULT 'soft',
  blocks_execution BOOLEAN NOT NULL DEFAULT false,
  academy_task_id UUID,
  unblock_condition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_capability_gaps_user ON erector_capability_gaps(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_capability_gaps_blueprint ON erector_capability_gaps(blueprint_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_capability_gaps_status ON erector_capability_gaps(status);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS erector_capability_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id),
  capability_id TEXT NOT NULL REFERENCES erector_capability_graph(capability_id),
  proof_level TEXT NOT NULL DEFAULT 'none',
  proof_count INTEGER NOT NULL DEFAULT 0,
  last_proof_evidence_id UUID,
  last_proven_at TIMESTAMPTZ,
  capability_signal INTEGER NOT NULL DEFAULT 0,
  signal_confidence TEXT NOT NULL DEFAULT 'LOW',
  decay_status TEXT NOT NULL DEFAULT 'current',
  decays_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_cap_profile_unique ON erector_capability_profiles(user_id, capability_id);
--> statement-breakpoint

-- PART 3 — phase gates
CREATE TABLE IF NOT EXISTS erector_phase_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id),
  phase_id UUID NOT NULL REFERENCES phases(id),
  phase_name TEXT NOT NULL,
  archetype TEXT NOT NULL,
  gate_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  outcome_validation_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  capability_gap_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  false_progress_flags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  readiness_score INTEGER NOT NULL DEFAULT 0,
  gate_result TEXT NOT NULL,
  blocking_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  correction_path_id UUID REFERENCES erector_correction_paths(id),
  gate_version TEXT NOT NULL DEFAULT 'v0.1',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_phase_gates_blueprint ON erector_phase_gates(blueprint_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_phase_gates_result ON erector_phase_gates(gate_result);
--> statement-breakpoint

-- PART 4 — false progress patterns (seeded in 0045)
CREATE TABLE IF NOT EXISTS erector_false_progress_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id TEXT NOT NULL UNIQUE,
  archetype TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  pattern_description TEXT NOT NULL,
  detection_logic TEXT NOT NULL,
  example TEXT NOT NULL,
  response_action TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  active BOOLEAN NOT NULL DEFAULT true,
  pattern_version TEXT NOT NULL DEFAULT 'v0.1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- PART 5 — resimulation
CREATE TABLE IF NOT EXISTS erector_resimulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id),
  original_simulation_id UUID NOT NULL REFERENCES erector_simulation_runs(id),
  trigger_type TEXT NOT NULL,
  trigger_description TEXT NOT NULL,
  changed_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_probability INTEGER,
  updated_probability INTEGER,
  probability_delta INTEGER,
  new_risk_flags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  new_correction_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  verdict_changed BOOLEAN NOT NULL DEFAULT false,
  previous_verdict TEXT,
  new_verdict TEXT,
  audit_id UUID,
  resimulation_model_version TEXT NOT NULL DEFAULT 'v0.1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_resimulation_blueprint ON erector_resimulation_runs(blueprint_id);
