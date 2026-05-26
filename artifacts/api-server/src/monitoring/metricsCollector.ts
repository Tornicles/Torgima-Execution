import { pool } from "@workspace/db";
import { buildProductionHealthResponse } from "../routes/health.js";
import { bhudhiHealthCheck } from "./healthCheck.js";

export interface BhudhiMetrics {
  timestamp: string;
  environment: string;
  version: string;
  platform: {
    health: Awaited<ReturnType<typeof buildProductionHealthResponse>>;
    bhudhi: Awaited<ReturnType<typeof bhudhiHealthCheck.check>>;
  };
  bhudhi: {
    kernelEventsLast24h: number | null;
    protocolMessagesLast24h: number | null;
    memoryNodes: number | null;
    executionsLast24h: number | null;
    runtimeSuccessRate: number | null;
  };
}

async function scalar(sql: string): Promise<number | null> {
  try {
    const result = await pool.query<{ c: string }>(sql);
    return Number(result.rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

export async function collectBhudhiMetrics(): Promise<BhudhiMetrics> {
  const [platformHealth, bhudhiHealth, kernel24h, protocol24h, memoryNodes, exec24h] =
    await Promise.all([
      buildProductionHealthResponse(),
      bhudhiHealthCheck.check(),
      scalar(
        `SELECT COUNT(*)::int AS c FROM bhudhi_kernel_events WHERE created_at > now() - interval '24 hours'`,
      ),
      scalar(
        `SELECT COUNT(*)::int AS c FROM bhudhi_protocol_messages WHERE sent_at > now() - interval '24 hours'`,
      ),
      scalar("SELECT COUNT(*)::int AS c FROM bhudhi_memory_nodes"),
      scalar(
        `SELECT COUNT(*)::int AS c FROM bhudhi_unified_execution_contexts WHERE started_at > now() - interval '24 hours'`,
      ),
    ]);

  let runtimeSuccessRate: number | null = null;
  try {
    const r = await pool.query<{ total: string; ok: string }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE success = true)::int AS ok
       FROM bhudhi_unified_execution_results`,
    );
    const total = Number(r.rows[0]?.total ?? 0);
    const ok = Number(r.rows[0]?.ok ?? 0);
    runtimeSuccessRate = total > 0 ? Math.round((ok / total) * 1000) / 10 : null;
  } catch {
    runtimeSuccessRate = null;
  }

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
    version: process.env.APP_VERSION ?? "2.0.0",
    platform: {
      health: platformHealth,
      bhudhi: bhudhiHealth,
    },
    bhudhi: {
      kernelEventsLast24h: kernel24h,
      protocolMessagesLast24h: protocol24h,
      memoryNodes,
      executionsLast24h: exec24h,
      runtimeSuccessRate,
    },
  };
}
