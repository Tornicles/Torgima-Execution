-- TASK_ENGINE_SPECIFICATION.md — visibility scheduling + mini plan tagging

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS visibility_date TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mini_plan_key TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_from_condition TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_blueprint_visibility
  ON orders (blueprint_id, is_visible, visibility_date);

CREATE INDEX IF NOT EXISTS idx_orders_blueprint_hidden
  ON orders (blueprint_id, status)
  WHERE status IN ('pre_generated', 'queued');
