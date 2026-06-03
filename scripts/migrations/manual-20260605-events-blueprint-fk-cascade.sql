-- Repair events.blueprint_id FK so blueprint/user purge cascades do not fail.
-- Idempotent: drops existing FK on events.blueprint_id (any name) and recreates with ON DELETE SET NULL.

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname
    INTO conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
   WHERE n.nspname = 'public'
     AND t.relname = 'events'
     AND c.contype = 'f'
     AND a.attname = 'blueprint_id'
   LIMIT 1;

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', conname);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
   WHERE n.nspname = 'public'
     AND t.relname = 'events'
     AND c.conname = 'events_blueprint_id_blueprints_id_fk'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_blueprint_id_blueprints_id_fk
      FOREIGN KEY (blueprint_id) REFERENCES public.blueprints(id) ON DELETE SET NULL;
  END IF;
END $$;
