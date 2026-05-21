-- IL5 — dependency mapping columns + intelligence verification indexes (DOC_26)

ALTER TABLE order_dependencies
  ADD COLUMN IF NOT EXISTS dependency_type TEXT NOT NULL DEFAULT 'SEQUENTIAL',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE project_dependencies
  ADD COLUMN IF NOT EXISTS dependency_type TEXT NOT NULL DEFAULT 'SEQUENTIAL',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_dependencies_blocked_status
  ON order_dependencies(blocked_order_id, status);

CREATE INDEX IF NOT EXISTS idx_decision_traces_user_id
  ON decision_traces(user_id)
  WHERE user_id IS NOT NULL;
