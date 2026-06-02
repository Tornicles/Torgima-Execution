-- Erector validation upgrade — structured panels + research log
CREATE TABLE IF NOT EXISTS validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_draft_id uuid REFERENCES blueprints(id) ON DELETE SET NULL,
  legacy_validation_id uuid REFERENCES validations(id) ON DELETE SET NULL,
  idea_title text NOT NULL,
  idea_description text,
  goal text NOT NULL,
  purpose text NOT NULL,
  timeframe text NOT NULL,
  context text,
  commitment_level text,
  domain_hints jsonb DEFAULT '[]'::jsonb,
  known_blockers text,
  status text NOT NULL DEFAULT 'pending',
  bhudhi_research_job_id text,
  research_completed_at timestamptz,
  verdict text,
  reality_score integer,
  reality_score_label text,
  verdict_summary text,
  verdict_badge text,
  selected_path text,
  blueprint_launched boolean NOT NULL DEFAULT false,
  launched_blueprint_id uuid REFERENCES blueprints(id) ON DELETE SET NULL,
  launched_at timestamptz,
  is_direction_anchor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_validation_runs_user ON validation_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_runs_status ON validation_runs(status);
CREATE INDEX IF NOT EXISTS idx_validation_runs_blueprint_draft ON validation_runs(blueprint_draft_id);

CREATE TABLE IF NOT EXISTS validation_at_a_glance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  problem_exists text,
  problem_exists_summary text,
  market_demand text,
  market_demand_summary text,
  competition_level text,
  competition_summary text,
  execution_fit text,
  execution_fit_summary text,
  feasibility text,
  feasibility_summary text,
  timing text,
  timing_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_at_a_glance_run ON validation_at_a_glance(validation_run_id);

CREATE TABLE IF NOT EXISTS validation_market_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  trend_summary text NOT NULL,
  trend_position text NOT NULL,
  growth_rate text,
  growth_rate_raw double precision,
  chart_data jsonb DEFAULT '[]'::jsonb,
  sources jsonb DEFAULT '[]'::jsonb,
  bhudhi_confidence text,
  researched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  name text NOT NULL,
  description text,
  website text,
  logo_url text,
  market_share_pct double precision,
  market_share_label text,
  strengths jsonb DEFAULT '[]'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  relevance_summary text,
  differentiation_hint text,
  source_url text,
  researched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_competitors_run ON validation_competitors(validation_run_id);
CREATE INDEX IF NOT EXISTS idx_competitors_rank ON validation_competitors(validation_run_id, rank);

CREATE TABLE IF NOT EXISTS validation_pros_cons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  type text NOT NULL,
  text text NOT NULL,
  weight text DEFAULT 'medium',
  explanation text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pros_cons_run ON validation_pros_cons(validation_run_id);

CREATE TABLE IF NOT EXISTS validation_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  impact text NOT NULL,
  how_to_capture text,
  relevant_path text DEFAULT 'all',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opportunities_run ON validation_opportunities(validation_run_id);

CREATE TABLE IF NOT EXISTS validation_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  risk_type text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL,
  mitigation text,
  blocks_launch boolean NOT NULL DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risks_run ON validation_risks(validation_run_id);

CREATE TABLE IF NOT EXISTS validation_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  path_type text NOT NULL,
  label text NOT NULL,
  is_recommended boolean NOT NULL DEFAULT false,
  description text NOT NULL,
  tagline text,
  success_potential text NOT NULL,
  estimated_outcome text NOT NULL,
  time_to_traction text NOT NULL,
  key_adjustments jsonb DEFAULT '[]'::jsonb,
  milestones jsonb DEFAULT '[]'::jsonb,
  path_specific_risks jsonb DEFAULT '[]'::jsonb,
  path_rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (validation_run_id, path_type)
);
CREATE INDEX IF NOT EXISTS idx_paths_run ON validation_paths(validation_run_id);

CREATE TABLE IF NOT EXISTS validation_bhudhi_research_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id uuid NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  research_phase text NOT NULL,
  search_query text NOT NULL,
  search_results_count integer,
  extracted_insights jsonb DEFAULT '{}'::jsonb,
  sources jsonb DEFAULT '[]'::jsonb,
  tokens_used integer,
  latency_ms integer,
  status text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
