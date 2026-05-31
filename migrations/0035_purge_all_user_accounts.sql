-- Irreversible: delete every user account and cascaded execution data (blueprints, projects, orders, validations).
-- Idempotent via platform_upgrade_migrations tracking row.

DO $$
DECLARE
  migration_id text := 'purge_all_users_v1_20260527';
  already_applied boolean;
  deleted_users integer := 0;
BEGIN
  SELECT EXISTS(SELECT 1 FROM platform_upgrade_migrations WHERE id = migration_id) INTO already_applied;
  IF already_applied THEN
    RAISE NOTICE 'Migration % already applied — skipping', migration_id;
    RETURN;
  END IF;

  -- Break optional user → blueprint pointer before cascade deletes
  UPDATE users SET active_blueprint_id = NULL WHERE active_blueprint_id IS NOT NULL;

  -- Remove upgrade archive rows (references users)
  DELETE FROM platform_upgrade_archive;

  -- Hard-delete all accounts; FK ON DELETE CASCADE removes blueprints, projects, plans, orders, validations, sessions, etc.
  DELETE FROM users;
  GET DIAGNOSTICS deleted_users = ROW_COUNT;

  INSERT INTO platform_upgrade_migrations (id, user_count, summary, rollback_available) -- rollback_available: false
  VALUES (
    migration_id,
    deleted_users,
    jsonb_build_object(
      'action', 'hard_delete_all_users',
      'deleted_users', deleted_users,
      'note', 'All user accounts and cascaded blueprint/project execution data removed. Users must sign up again.'
    ),
    false
  );

  RAISE NOTICE 'Purge migration % complete — % user accounts deleted', migration_id, deleted_users;
END $$;
