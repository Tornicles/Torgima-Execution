-- ============================================================
-- TORGIMA — PARTIAL UNIQUE INDEXES
-- Run once after initial schema push.
-- These enforce single-row invariants for is_current patterns.
-- ============================================================

-- 1. One active blueprint per user
CREATE UNIQUE INDEX IF NOT EXISTS one_active_blueprint_per_user
  ON blueprints(user_id)
  WHERE active = TRUE;

-- 2. One current signal snapshot per blueprint
CREATE UNIQUE INDEX IF NOT EXISTS one_current_signal_per_blueprint
  ON signal_snapshots(blueprint_id)
  WHERE is_current = TRUE;

-- 3. One current condition per blueprint
CREATE UNIQUE INDEX IF NOT EXISTS one_current_condition_per_blueprint
  ON conditions(blueprint_id)
  WHERE is_current = TRUE;

-- 4. One current enforcement package per blueprint
CREATE UNIQUE INDEX IF NOT EXISTS one_current_enforcement_per_blueprint
  ON enforcement_packages(blueprint_id)
  WHERE is_current = TRUE;

-- 5. One current state memory per blueprint
CREATE UNIQUE INDEX IF NOT EXISTS one_current_state_memory_per_blueprint
  ON state_memory(blueprint_id)
  WHERE is_current = TRUE;

-- 6. One current domain per blueprint
CREATE UNIQUE INDEX IF NOT EXISTS one_current_domain_per_blueprint
  ON domain_history(blueprint_id)
  WHERE is_current = TRUE;

-- Verify all indexes were created
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname IN (
  'one_active_blueprint_per_user',
  'one_current_signal_per_blueprint',
  'one_current_condition_per_blueprint',
  'one_current_enforcement_per_blueprint',
  'one_current_state_memory_per_blueprint',
  'one_current_domain_per_blueprint'
)
ORDER BY tablename;
