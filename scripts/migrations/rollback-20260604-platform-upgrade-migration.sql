-- Rollback platform upgrade v1 (restore user execution flags only — full entity restore requires per-row payload replay)
-- Run only if platform_upgrade_migrations contains platform_upgrade_v1_20260604

DO $$
DECLARE
  migration_id text := 'platform_upgrade_v1_20260604';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform_upgrade_migrations WHERE id = migration_id) THEN
    RAISE NOTICE 'Migration % not applied — nothing to rollback', migration_id;
    RETURN;
  END IF;

  UPDATE users u
  SET
    execution_state = 'NORMAL',
    first_login_after_upgrade = false,
    onboarding_complete = COALESCE(
      (u.metadata->>'prior_onboarding_complete')::boolean,
      u.onboarding_complete
    ),
    active_blueprint_id = COALESCE(
      (u.metadata->>'prior_active_blueprint_id')::uuid,
      u.active_blueprint_id
    ),
    updated_at = now()
  WHERE u.execution_state = 'RESET_REQUIRED'
     OR u.metadata ? 'upgrade_reset_at';

  DELETE FROM platform_upgrade_migrations WHERE id = migration_id;

  RAISE NOTICE 'Platform upgrade user flags rolled back. Archived rows remain in platform_upgrade_archive for manual entity restore.';
END $$;
