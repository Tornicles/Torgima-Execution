-- PROMPT 5 — Blueprint controls Erector baseline + execution lock
-- Safe additive migration: new columns + new reality package table.

-- 1) Blueprint-level baseline + execution gating
ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS erector_baseline_state text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS execution_state text NOT NULL DEFAULT 'locked',
  ADD COLUMN IF NOT EXISTS dashboard_mode text NOT NULL DEFAULT 'limited_activation',
  ADD COLUMN IF NOT EXISTS erector_baseline_id uuid,
  ADD COLUMN IF NOT EXISTS baseline_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS baseline_error_class text,
  ADD COLUMN IF NOT EXISTS baseline_error_message text;

-- 2) Reality package persistence (structured JSON baseline)
CREATE TABLE IF NOT EXISTS erector_reality_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  validation_run_id uuid,
  intake_session_id uuid,
  tier text,
  model_version text NOT NULL DEFAULT 'v0.1',
  package_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erector_reality_packages_blueprint_id
  ON erector_reality_packages(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_erector_reality_packages_user_id
  ON erector_reality_packages(user_id);

-- 3) Attach baseline reference to blueprint (FK kept loose to avoid circular Drizzle typing)
-- We keep blueprint.erector_baseline_id as a uuid with no FK constraint to avoid migration order coupling.

-- 4) Order traceability (don’t create executable orders without baseline/archetype)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS erector_archetype text,
  ADD COLUMN IF NOT EXISTS erector_baseline_id uuid,
  ADD COLUMN IF NOT EXISTS baseline_version text;

CREATE INDEX IF NOT EXISTS idx_orders_erector_baseline_id
  ON orders(erector_baseline_id);

