-- MINI_PLAN_ALLOCATION_SPECIFICATION.md

CREATE TABLE IF NOT EXISTS mini_plan_allocation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  condition TEXT NOT NULL,
  allocation JSONB NOT NULL DEFAULT '{}'::jsonb,
  daily_task_counts JSONB,
  previous_condition TEXT,
  reason TEXT,
  tasks_affected INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mini_plan_allocation_history_blueprint
  ON mini_plan_allocation_history (blueprint_id, created_at DESC);
