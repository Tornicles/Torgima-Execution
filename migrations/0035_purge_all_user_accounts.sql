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

  -- Detach / remove event references that lack ON DELETE CASCADE (blocks DELETE FROM events)
  UPDATE signal_snapshots SET causation_event_id = NULL WHERE causation_event_id IS NOT NULL;
  UPDATE domain_history SET trigger_event_id = NULL WHERE trigger_event_id IS NOT NULL;
  UPDATE inactivity_records SET response_event_id = NULL WHERE response_event_id IS NOT NULL;
  DELETE FROM events;

  -- Detach rows that block deletes of blueprint-scoped tables (FK ON DELETE NO ACTION → blueprints.id)
  UPDATE behavior_events SET pattern_id = NULL WHERE pattern_id IS NOT NULL;
  UPDATE academy_tasks SET knowledge_id = NULL WHERE knowledge_id IS NOT NULL;

  DELETE FROM system_health_logs WHERE blueprint_id IS NOT NULL;
  DELETE FROM behavior_patterns WHERE blueprint_id IS NOT NULL;
  DELETE FROM bhudhi_memory WHERE blueprint_id IS NOT NULL;
  DELETE FROM capability_profiles WHERE blueprint_id IS NOT NULL;
  DELETE FROM eis_call_logs WHERE blueprint_id IS NOT NULL;
  DELETE FROM knowledge_objects WHERE blueprint_id IS NOT NULL;
  DELETE FROM notification_logs WHERE blueprint_id IS NOT NULL;

  -- Erector governance/ops tables may reference users without cascade.
  DELETE FROM erector_system_error_records;

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
