-- TORGIMA Supabase / Postgres healing queries (read-only diagnostics + optional repair hints)
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/supabase-healing-queries.sql

\echo '=== STUCK EVENTS (pending > 5 minutes) ==='
SELECT status, COUNT(*) AS cnt, MIN(process_after) AS oldest
FROM events
WHERE status IN ('pending', 'retry_pending')
  AND process_after < NOW() - INTERVAL '5 minutes'
GROUP BY status
ORDER BY cnt DESC;

\echo '=== CLAIMED EVENTS STALE (> 15 minutes) ==='
SELECT id, event_type, blueprint_id, status, claimed_at, retry_count
FROM events
WHERE status = 'claimed'
  AND claimed_at < NOW() - INTERVAL '15 minutes'
ORDER BY claimed_at ASC
LIMIT 25;

\echo '=== DEAD LETTER QUEUE (unresolved) ==='
SELECT event_type, COUNT(*) AS cnt, MAX(created_at) AS latest
FROM dead_letter_events
WHERE resolved = false
GROUP BY event_type
ORDER BY cnt DESC;

\echo '=== CRITICAL DLQ (execution loop) ==='
SELECT id, event_type, blueprint_id, user_id, failure_reason, created_at
FROM dead_letter_events
WHERE resolved = false
  AND event_type IN (
    'feedback_submitted',
    'signal_recalculation_requested',
    'condition_evaluated',
    'enforcement_package_requested',
    'task_generation_requested'
  )
ORDER BY created_at DESC
LIMIT 20;

\echo '=== BLUEPRINT HIERARCHY COUNTS (active blueprints) ==='
SELECT
  b.id AS blueprint_id,
  b.user_id,
  (SELECT COUNT(*) FROM plans p WHERE p.blueprint_id = b.id) AS plans,
  (SELECT COUNT(*) FROM targets t WHERE t.blueprint_id = b.id) AS targets,
  (SELECT COUNT(*) FROM phases ph WHERE ph.blueprint_id = b.id) AS phases,
  (SELECT COUNT(*) FROM projects pr WHERE pr.blueprint_id = b.id) AS projects,
  (SELECT COUNT(*) FROM actions a WHERE a.blueprint_id = b.id) AS actions,
  (SELECT COUNT(*) FROM orders o WHERE o.blueprint_id = b.id) AS orders,
  (SELECT COUNT(*) FROM orders o WHERE o.blueprint_id = b.id AND o.linked_action_id IS NULL) AS orphan_orders
FROM blueprints b
WHERE b.active = true AND b.status = 'active'
ORDER BY orphan_orders DESC, plans ASC
LIMIT 30;

\echo '=== ACTIVE BLUEPRINTS WITH ZERO PENDING TASKS ==='
SELECT b.id, b.user_id, b.goal
FROM blueprints b
WHERE b.active = true
  AND b.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.blueprint_id = b.id
      AND o.status IN ('pending', 'active', 'needs_feedback')
  )
LIMIT 20;

\echo '=== VALIDATIONS STUCK IN RUNNING (> 5 min) ==='
SELECT id, blueprint_id, user_id, status, validation_stage, erector_validation_stage, updated_at
FROM validations
WHERE status = 'running'
  AND updated_at < NOW() - INTERVAL '5 minutes'
ORDER BY updated_at ASC
LIMIT 15;

\echo '=== REPAIR HINTS (manual) ==='
\echo '-- Re-queue stuck pending: POST /api/internal/events/dispatch (INTERNAL_AUTH)'
\echo '-- Replay one event: POST /api/internal/events/:id/replay'
\echo '-- Regenerate tasks: constitution audit or POST task_generation_requested event'
