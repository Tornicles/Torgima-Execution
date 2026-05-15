-- Prompt 7: validation memory + strategic assumption monitoring

CREATE TABLE IF NOT EXISTS validation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  validation_id UUID REFERENCES validations(id),
  goal_hash TEXT NOT NULL,
  raw_goal_snapshot TEXT,
  verdict TEXT,
  clarity_score DOUBLE PRECISION,
  feasibility_score DOUBLE PRECISION,
  realism_score DOUBLE PRECISION,
  industry_label TEXT,
  selected_path TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_memory_user_id ON validation_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_memory_goal_hash ON validation_memory(goal_hash);
CREATE INDEX IF NOT EXISTS idx_validation_memory_blueprint_id ON validation_memory(blueprint_id);

CREATE TABLE IF NOT EXISTS strategic_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  validation_id UUID REFERENCES validations(id),
  assumption_text TEXT NOT NULL,
  industry_context TEXT,
  monitoring_status TEXT NOT NULL DEFAULT 'active',
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategic_assumptions_blueprint_id ON strategic_assumptions(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_strategic_assumptions_status ON strategic_assumptions(monitoring_status);
