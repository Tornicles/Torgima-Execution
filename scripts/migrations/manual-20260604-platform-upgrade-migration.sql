-- Platform upgrade data migration (non-destructive archive + user reset)
-- Rollback: restore from platform_upgrade_archive payloads + platform_upgrade_migrations summary

DO $$
DECLARE
  migration_id text := 'platform_upgrade_v1_20260604';
  already_applied boolean;
  affected_users integer := 0;
BEGIN
  SELECT EXISTS(SELECT 1 FROM platform_upgrade_migrations WHERE id = migration_id) INTO already_applied;
  IF already_applied THEN
    RAISE NOTICE 'Migration % already applied — skipping', migration_id;
    RETURN;
  END IF;

  -- Archive validations
  INSERT INTO platform_upgrade_archive (user_id, entity_type, entity_id, payload, archived_by_upgrade)
  SELECT v.user_id, 'validation', v.id, to_jsonb(v.*), true
  FROM validations v;

  -- Archive blueprints
  INSERT INTO platform_upgrade_archive (user_id, entity_type, entity_id, payload, archived_by_upgrade)
  SELECT b.user_id, 'blueprint', b.id, to_jsonb(b.*), true
  FROM blueprints b;

  -- Archive orders
  INSERT INTO platform_upgrade_archive (user_id, entity_type, entity_id, payload, archived_by_upgrade)
  SELECT o.user_id, 'order', o.id, to_jsonb(o.*), true
  FROM orders o
  WHERE o.user_id IS NOT NULL;

  -- Archive execution plans
  INSERT INTO platform_upgrade_archive (user_id, entity_type, entity_id, payload, archived_by_upgrade)
  SELECT p.user_id, 'plan', p.id, to_jsonb(p.*), true
  FROM plans p
  WHERE p.user_id IS NOT NULL;

  -- Archive signal snapshots
  INSERT INTO platform_upgrade_archive (user_id, entity_type, entity_id, payload, archived_by_upgrade)
  SELECT ss.user_id, 'signal_snapshot', ss.id, to_jsonb(ss.*), true
  FROM signal_snapshots ss
  WHERE ss.user_id IS NOT NULL;

  -- Archive milestones
  INSERT INTO platform_upgrade_archive (user_id, entity_type, entity_id, payload, archived_by_upgrade)
  SELECT m.user_id, 'milestone', m.id, to_jsonb(m.*), true
  FROM milestones m
  WHERE m.user_id IS NOT NULL;

  -- Deactivate execution artifacts (no hard delete)
  UPDATE blueprints SET active = false, status = 'abandoned', updated_at = now()
  WHERE status IN ('active', 'draft', 'validating', 'path_selection', 'awaiting_selection', 'paused');

  UPDATE orders SET status = 'cancelled', updated_at = now()
  WHERE status IN ('pending', 'active', 'paused', 'blocked', 'needs_feedback', 'needs_proof', 'pre_generated');

  UPDATE plans SET status = 'skipped', updated_at = now()
  WHERE status IN ('active', 'pending');

  -- Reset users who had prior execution (onboarding complete OR active blueprint)
  WITH reset_users AS (
    UPDATE users u
    SET
      onboarding_complete = false,
      active_blueprint_id = null,
      execution_state = 'RESET_REQUIRED',
      first_login_after_upgrade = true,
      metadata = COALESCE(u.metadata, '{}'::jsonb) || jsonb_build_object(
        'upgrade_reset_at', now(),
        'upgrade_reset_version', 'platform_upgrade_v1_20260604',
        'prior_active_blueprint_id', u.active_blueprint_id
      ),
      updated_at = now()
    WHERE u.onboarding_complete = true
       OR u.active_blueprint_id IS NOT NULL
       OR EXISTS (SELECT 1 FROM blueprints b WHERE b.user_id = u.id AND b.status = 'active')
    RETURNING u.id
  )
  SELECT COUNT(*) INTO affected_users FROM reset_users;

  INSERT INTO platform_upgrade_migrations (id, user_count, summary)
  VALUES (
    migration_id,
    affected_users,
    jsonb_build_object(
      'archived_entity_types', jsonb_build_array('validation', 'blueprint', 'order', 'plan', 'signal_snapshot', 'milestone'),
      'note', 'Users must restart via /validate Erector flow. Data preserved in platform_upgrade_archive.'
    )
  );

  RAISE NOTICE 'Platform upgrade migration % complete — % users reset', migration_id, affected_users;
END $$;
