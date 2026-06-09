-- Manual production run: delete ALL user accounts and cascaded projects/blueprints/orders.
-- IRREVERSIBLE. Mirror of migrations/0035_purge_all_user_accounts.sql

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

  UPDATE users SET active_blueprint_id = NULL WHERE active_blueprint_id IS NOT NULL;
  DELETE FROM platform_upgrade_archive;
  UPDATE signal_snapshots SET causation_event_id = NULL WHERE causation_event_id IS NOT NULL;
  UPDATE domain_history SET trigger_event_id = NULL WHERE trigger_event_id IS NOT NULL;
  UPDATE inactivity_records SET response_event_id = NULL WHERE response_event_id IS NOT NULL;
  DELETE FROM events;

  UPDATE behavior_events SET pattern_id = NULL WHERE pattern_id IS NOT NULL;
  UPDATE academy_tasks SET knowledge_id = NULL WHERE knowledge_id IS NOT NULL;

  DELETE FROM system_health_logs WHERE blueprint_id IS NOT NULL;
  DELETE FROM behavior_patterns WHERE blueprint_id IS NOT NULL;
  DELETE FROM bhudhi_memory WHERE blueprint_id IS NOT NULL;
  DELETE FROM capability_profiles WHERE blueprint_id IS NOT NULL;
  DELETE FROM eis_call_logs WHERE blueprint_id IS NOT NULL;
  DELETE FROM knowledge_objects WHERE blueprint_id IS NOT NULL;
  DELETE FROM notification_logs WHERE blueprint_id IS NOT NULL;

  DELETE FROM users;
  GET DIAGNOSTICS deleted_users = ROW_COUNT;

  INSERT INTO platform_upgrade_migrations (id, user_count, summary, rollback_available)
  VALUES (
    migration_id,
    deleted_users,
    jsonb_build_object(
      'action', 'hard_delete_all_users',
      'deleted_users', deleted_users,
      'note', 'All user accounts and cascaded blueprint/project execution data removed.'
    ),
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Purged % user accounts', deleted_users;
END $$;
