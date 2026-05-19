-- Blueprint launch production repair.
-- Adds the compatibility columns required for validation -> launch -> dashboard handoff.

ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS raw_goal text,
  ADD COLUMN IF NOT EXISTS timeframe_days integer,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS location jsonb,
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS online_offline text,
  ADD COLUMN IF NOT EXISTS budget double precision,
  ADD COLUMN IF NOT EXISTS current_resources jsonb,
  ADD COLUMN IF NOT EXISTS target_customers text,
  ADD COLUMN IF NOT EXISTS target_profit double precision,
  ADD COLUMN IF NOT EXISTS selected_path text,
  ADD COLUMN IF NOT EXISTS selected_blueprint_level text,
  ADD COLUMN IF NOT EXISTS validation_verdict text,
  ADD COLUMN IF NOT EXISTS validation_scores jsonb,
  ADD COLUMN IF NOT EXISTS validation_report jsonb,
  ADD COLUMN IF NOT EXISTS path_options jsonb,
  ADD COLUMN IF NOT EXISTS blueprint_options jsonb,
  ADD COLUMN IF NOT EXISTS current_project_id uuid,
  ADD COLUMN IF NOT EXISTS current_action_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE targets
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS metric_name text,
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE phases
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS progress_percent double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlock_criteria jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS project_type text,
  ADD COLUMN IF NOT EXISTS progress_percent double precision NOT NULL DEFAULT 0;

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS expected_output text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS context_why text,
  ADD COLUMN IF NOT EXISTS order_type text,
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_estimate_mins integer;

ALTER TABLE signal_snapshots
  ADD COLUMN IF NOT EXISTS week_start timestamptz,
  ADD COLUMN IF NOT EXISTS daily_score double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condition text;

ALTER TABLE conditions
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE enforcement_packages
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS restricted_actions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE state_memory
  ADD COLUMN IF NOT EXISTS current_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_event text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_targets_user_id ON targets(user_id);
CREATE INDEX IF NOT EXISTS idx_phases_blueprint_active ON phases(blueprint_id, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_action_id ON orders(action_id);
CREATE INDEX IF NOT EXISTS idx_signal_snapshots_week_start ON signal_snapshots(week_start);
CREATE INDEX IF NOT EXISTS idx_enforcement_packages_user_id ON enforcement_packages(user_id);
