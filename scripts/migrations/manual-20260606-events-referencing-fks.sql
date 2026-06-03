-- signal_snapshots, domain_history, inactivity_records → events without ON DELETE blocked purge.
-- Recreate FKs with ON DELETE SET NULL (idempotent).

DO $$
DECLARE
  old_con text;
  spec record;
BEGIN
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('signal_snapshots', 'causation_event_id', 'signal_snapshots_causation_event_id_events_id_fk'),
      ('domain_history', 'trigger_event_id', 'domain_history_trigger_event_id_events_id_fk'),
      ('inactivity_records', 'response_event_id', 'inactivity_records_response_event_id_events_id_fk')
    ) AS t(tbl, col, new_conname)
  LOOP
    old_con := NULL;
    SELECT c.conname
      INTO old_con
      FROM pg_constraint c
      JOIN pg_class rel ON c.conrelid = rel.oid
      JOIN pg_namespace n ON rel.relnamespace = n.oid
      JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = ANY (c.conkey)
     WHERE n.nspname = 'public'
       AND rel.relname = spec.tbl
       AND c.contype = 'f'
       AND a.attname = spec.col
     LIMIT 1;

    IF old_con IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', spec.tbl, old_con);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON c.conrelid = rel.oid
      JOIN pg_namespace n ON rel.relnamespace = n.oid
     WHERE n.nspname = 'public'
       AND rel.relname = spec.tbl
       AND c.conname = spec.new_conname
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.events(id) ON DELETE SET NULL',
        spec.tbl,
        spec.new_conname,
        spec.col
      );
    END IF;
  END LOOP;
END $$;
