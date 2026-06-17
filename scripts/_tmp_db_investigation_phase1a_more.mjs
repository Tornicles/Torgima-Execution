#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;

const DATABASE_URL =
  (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) ||
  "postgresql://postgres:postgres@127.0.0.1:5432/torgima_test";

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const queries = {
    blueprint_archetypes: `
SELECT b.id, b.erector_archetype, b.erector_state, b.blueprint_source, u.dashboard_mode
FROM blueprints b
JOIN users u ON u.id = b.user_id
WHERE b.erector_archetype IS NOT NULL
LIMIT 5;`.trim(),

    signal_snapshots_current: `
SELECT blueprint_id, completion_rate, weighted_score_avg,
  momentum_days, trend, is_current, calculated_at
FROM signal_snapshots
WHERE is_current = true
ORDER BY calculated_at DESC
LIMIT 5;`.trim(),

    conditions_current: `
SELECT c.blueprint_id, c.condition_state, c.is_current,
  c.created_at, u.email
FROM conditions c
JOIN blueprints b ON b.id = c.blueprint_id
JOIN users u ON u.id = b.user_id
WHERE c.is_current = true
ORDER BY c.created_at DESC
LIMIT 5;`.trim(),

    enforcement_current: `
SELECT ep.blueprint_id, ep.condition_state, ep.task_limit,
  ep.difficulty_cap, ep.is_current, ep.created_at
FROM enforcement_packages ep
WHERE ep.is_current = true
ORDER BY ep.created_at DESC
LIMIT 5;`.trim(),

    bhudhi_logs_stats: `
SELECT trigger_type, status, COUNT(*) as calls,
  AVG(tokens_used) as avg_tokens,
  MAX(created_at) as latest_call
FROM bhudhi_logs
GROUP BY trigger_type, status
ORDER BY latest_call DESC
LIMIT 20;`.trim(),

    events_stats: `
SELECT event_type, status, COUNT(*) as count,
  MAX(created_at) as latest
FROM events
GROUP BY event_type, status
ORDER BY latest DESC
LIMIT 20;`.trim(),

    dead_letter_latest: `
SELECT event_type, error_message, retry_count, created_at
FROM dead_letter_events
ORDER BY created_at DESC
LIMIT 10;`.trim(),

    orders_latest: `
SELECT o.blueprint_id, o.status, o.task_type,
  o.difficulty, o.created_at,
  b.erector_archetype, b.erector_state
FROM orders o
JOIN blueprints b ON b.id = o.blueprint_id
ORDER BY o.created_at DESC
LIMIT 10;`.trim(),

    system_health_logs: `
SELECT status, check_type, COUNT(*), MAX(created_at) as latest
FROM system_health_logs
GROUP BY status, check_type
ORDER BY latest DESC
LIMIT 20;`.trim(),

    erector_errors: `
SELECT error_type, source_engine, COUNT(*) as count,
  MAX(created_at) as latest
FROM erector_system_error_records
GROUP BY error_type, source_engine
ORDER BY latest DESC
LIMIT 20;`.trim(),

    erector_signals_stats: `
SELECT signal_type, COUNT(*), MAX(generated_at) as latest
FROM erector_signals
GROUP BY signal_type
ORDER BY signal_type;`.trim(),
  };

  const out = { generatedAt: new Date().toISOString(), databaseUrl: DATABASE_URL, results: {} };
  for (const [name, sql] of Object.entries(queries)) {
    try {
      const r = await client.query(sql);
      out.results[name] = { ok: true, rowCount: r.rowCount, rows: r.rows };
    } catch (e) {
      out.results[name] = { ok: false, error: String(e?.message ?? e) };
    }
  }

  console.log(JSON.stringify(out, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

