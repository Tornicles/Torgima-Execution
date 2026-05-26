-- Prompt 1: 25-sequence tracking foundation (history, tier gates, blueprint audit columns)

CREATE TABLE IF NOT EXISTS blueprint_sequence_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  sequence_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  state_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_passed boolean NOT NULL DEFAULT false,
  validation_errors text[] NOT NULL DEFAULT ARRAY[]::text[],
  duration_ms integer,
  user_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_sequence_history_blueprint_id
  ON blueprint_sequence_history(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_sequence_history_sequence_number
  ON blueprint_sequence_history(sequence_number);

CREATE TABLE IF NOT EXISTS tier_sequence_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_tier text NOT NULL,
  sequence_number integer NOT NULL,
  unlocks_after_seq integer,
  requires_tier text,
  unlocks_feature text,
  feature_description text,
  is_growth_only boolean NOT NULL DEFAULT false,
  is_ultimate_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tier_sequence_gates_tier_seq_feature
  ON tier_sequence_gates(blueprint_tier, sequence_number, COALESCE(unlocks_feature, ''));
CREATE INDEX IF NOT EXISTS idx_tier_sequence_gates_blueprint_tier
  ON tier_sequence_gates(blueprint_tier);

ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS current_sequence_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sequences_completed_numbers integer[] NOT NULL DEFAULT ARRAY[]::integer[],
  ADD COLUMN IF NOT EXISTS tier_sequence_gates jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sequence_audit_log text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS last_sequence_update timestamptz;
