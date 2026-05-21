-- IL5 — create dependency tables when missing from live DB

CREATE TABLE IF NOT EXISTS order_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  blocking_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  blocked_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'SEQUENTIAL',
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocking_order_id, blocked_order_id)
);

ALTER TABLE order_dependencies
  ADD COLUMN IF NOT EXISTS dependency_type TEXT NOT NULL DEFAULT 'SEQUENTIAL',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_dependencies_blocked_status
  ON order_dependencies(blocked_order_id, status);

CREATE TABLE IF NOT EXISTS project_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  blocking_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  blocked_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'SEQUENTIAL',
  status TEXT NOT NULL DEFAULT 'PENDING',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocking_project_id, blocked_project_id)
);
