-- BHUDHI Prompt 4: Stability, Critic, Debate, Meta-Cognition

CREATE TABLE IF NOT EXISTS stability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'MEDIUM',
  description text NOT NULL,
  agent_involved text,
  trigger_type text,
  resolution text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stability_events_user_id ON stability_events(user_id);
CREATE INDEX IF NOT EXISTS idx_stability_events_created_at ON stability_events(created_at);

CREATE TABLE IF NOT EXISTS agent_conflict_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_a text NOT NULL,
  agent_b text NOT NULL,
  trigger_type text NOT NULL,
  agent_a_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_b_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  conflict_type text NOT NULL,
  resolution text NOT NULL,
  resolved_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_conflict_logs_user_id ON agent_conflict_logs(user_id);

CREATE TABLE IF NOT EXISTS critic_review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bhudhi_log_id uuid NOT NULL REFERENCES bhudhi_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewing_agent text NOT NULL DEFAULT 'CRITIC',
  input_agent text NOT NULL,
  verdict text NOT NULL,
  confidence_score double precision NOT NULL DEFAULT 0.5,
  confidence_tier text NOT NULL DEFAULT 'MEDIUM',
  rejection_reason text,
  flag_reason text,
  governance_violation boolean NOT NULL DEFAULT false,
  violation_detail text,
  revised_output jsonb,
  revision_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_critic_review_logs_bhudhi_log_id ON critic_review_logs(bhudhi_log_id);
CREATE INDEX IF NOT EXISTS idx_critic_review_logs_user_id ON critic_review_logs(user_id);

CREATE TABLE IF NOT EXISTS debate_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  debate_topic text NOT NULL,
  rounds jsonb NOT NULL DEFAULT '[]'::jsonb,
  consensus_reached boolean NOT NULL DEFAULT false,
  final_verdict jsonb NOT NULL DEFAULT '{}'::jsonb,
  judge_rationale text NOT NULL DEFAULT '',
  debate_duration_ms integer NOT NULL DEFAULT 0,
  agents_involved text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debate_logs_user_id ON debate_logs(user_id);

CREATE TABLE IF NOT EXISTS meta_cognition_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL UNIQUE,
  domain_reliability jsonb NOT NULL DEFAULT '[]'::jsonb,
  prediction_accuracy double precision NOT NULL DEFAULT 0.5,
  total_predictions integer NOT NULL DEFAULT 0,
  correct_predictions integer NOT NULL DEFAULT 0,
  hallucination_risk double precision NOT NULL DEFAULT 0.2,
  strong_domains text[] NOT NULL DEFAULT ARRAY[]::text[],
  weak_domains text[] NOT NULL DEFAULT ARRAY[]::text[],
  last_calibration_update timestamptz NOT NULL DEFAULT now(),
  calibration_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fallback_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL,
  prompt_name text NOT NULL,
  reason text NOT NULL,
  fallback_type text NOT NULL DEFAULT 'DETERMINISTIC_TEMPLATE',
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  bhudhi_log_id uuid REFERENCES bhudhi_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fallback_usage_logs_created_at ON fallback_usage_logs(created_at);
