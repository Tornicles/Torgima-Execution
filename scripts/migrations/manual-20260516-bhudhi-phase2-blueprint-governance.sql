-- Bhudhi Prompt 2: Governance Queue, Blueprint Health, Blueprint Interpretation

DO $$ BEGIN
  ALTER TYPE bhudhi_trigger_type ADD VALUE IF NOT EXISTS 'blueprint_generation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE bhudhi_trigger_type ADD VALUE IF NOT EXISTS 'blueprint_interpretation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS governance_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  proposal_type text NOT NULL,
  proposing_agent text NOT NULL DEFAULT 'BLUEPRINT',
  proposal_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text NOT NULL,
  evidence_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  impact_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  priority text NOT NULL DEFAULT 'NORMAL',
  expires_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  approval_note text,
  world_state_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_queue_blueprint_id ON governance_queue(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_governance_queue_status ON governance_queue(blueprint_id, status);

CREATE TABLE IF NOT EXISTS blueprint_health_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  health_score double precision NOT NULL,
  phase_progress_rate double precision NOT NULL DEFAULT 0,
  target_achievement_rate double precision NOT NULL DEFAULT 0,
  action_coverage_rate double precision NOT NULL DEFAULT 0,
  gaps_detected jsonb NOT NULL DEFAULT '[]'::jsonb,
  dead_actions_count integer NOT NULL DEFAULT 0,
  stagnant_phases_count integer NOT NULL DEFAULT 0,
  weak_targets_count integer NOT NULL DEFAULT 0,
  proposals_generated integer NOT NULL DEFAULT 0,
  agent_assessment text NOT NULL,
  confidence_tier text NOT NULL DEFAULT 'MEDIUM',
  world_state_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_health_records_blueprint_id ON blueprint_health_records(blueprint_id);

CREATE TABLE IF NOT EXISTS blueprint_interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL UNIQUE REFERENCES blueprints(id) ON DELETE CASCADE,
  interpretation text NOT NULL,
  key_insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_focus text NOT NULL,
  next_milestone text NOT NULL,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_tier text NOT NULL DEFAULT 'MEDIUM',
  world_state_version integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blueprint_interpretations_blueprint_id ON blueprint_interpretations(blueprint_id);
