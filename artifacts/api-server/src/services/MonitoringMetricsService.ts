import { pool } from "@workspace/db";
import { getEventSystemHealth } from "./EventDispatcher.js";

export interface ProductionMetrics {
  pending_event_count: number;
  oldest_pending_event_age_ms: number;
  dead_letter_count: number;
  event_processing_latency_ms_p50: number;
  health_check_error_count_24h: number;
  validation_pipeline_failure_rate: number;
  eis_cost_per_day_usd: number;
  projection_lag_versions: number;
  task_guarantee_miss_count_24h: number;
  collected_at: string;
}

export async function collectProductionMetrics(): Promise<ProductionMetrics> {
  const eventHealth = await getEventSystemHealth();

  const pendingAge = await pool.query<{ age_ms: string }>(`
    SELECT COALESCE(
      EXTRACT(EPOCH FROM (NOW() - MIN(process_after))) * 1000,
      0
    )::bigint AS age_ms
    FROM events WHERE status IN ('pending', 'retry_pending')
  `);

  const latency = await pool.query<{ p50: string }>(`
    SELECT COALESCE(
      percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms),
      0
    )::int AS p50
    FROM event_logs
    WHERE processed_at > NOW() - INTERVAL '1 hour' AND duration_ms IS NOT NULL
  `);

  const healthErrors = await pool.query<{ c: string }>(`
    SELECT COUNT(*)::int AS c FROM system_health_logs
    WHERE status = 'degraded' AND created_at > NOW() - INTERVAL '24 hours'
  `);

  const validationFails = await pool.query<{ c: string; total: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS c,
      COUNT(*)::int AS total
    FROM validation_event_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);

  const eisCost = await pool.query<{ cost: string }>(`
    SELECT COALESCE(SUM(estimated_cost_usd), 0)::float AS cost
    FROM eis_call_logs
    WHERE created_at > NOW() - INTERVAL '24 hours' AND cache_hit = false
  `);

  const guaranteeMiss = await pool.query<{ c: string }>(`
    SELECT COUNT(*)::int AS c FROM task_generation_log
    WHERE generation_trigger = 'recovery_triggered'
      AND created_at > NOW() - INTERVAL '24 hours'
  `);

  const vf = validationFails.rows[0];
  const failCount = Number(vf?.c ?? 0);
  const failTotal = Number(vf?.total ?? 0);

  return {
    pending_event_count: eventHealth.pending_events,
    oldest_pending_event_age_ms: Number(pendingAge.rows[0]?.age_ms ?? 0),
    dead_letter_count: eventHealth.unresolved_dead_letters,
    event_processing_latency_ms_p50: Number(latency.rows[0]?.p50 ?? 0),
    health_check_error_count_24h: Number(healthErrors.rows[0]?.c ?? 0),
    validation_pipeline_failure_rate:
      failTotal > 0 ? Math.round((failCount / failTotal) * 100) / 100 : 0,
    eis_cost_per_day_usd: Number(eisCost.rows[0]?.cost ?? 0),
    projection_lag_versions: 0,
    task_guarantee_miss_count_24h: Number(guaranteeMiss.rows[0]?.c ?? 0),
    collected_at: new Date().toISOString(),
  };
}
