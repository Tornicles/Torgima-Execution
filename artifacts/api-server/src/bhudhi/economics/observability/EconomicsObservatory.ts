import { db, bhudhiEconomicsSessions, bhudhiLogs } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import type { EconomicsObservatoryMetrics } from "../contracts/types.js";

export class EconomicsObservatory {
  async collect(userId: string, hours = 24): Promise<EconomicsObservatoryMetrics> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    let sessions: Array<{
      execution_mode: string;
      value_score: number;
      cache_hit: boolean;
      actual_cost_usd: number | null;
      estimated_cost_usd: number;
    }> = [];

    try {
      sessions = await db
        .select({
          execution_mode: bhudhiEconomicsSessions.execution_mode,
          value_score: bhudhiEconomicsSessions.value_score,
          cache_hit: bhudhiEconomicsSessions.cache_hit,
          actual_cost_usd: bhudhiEconomicsSessions.actual_cost_usd,
          estimated_cost_usd: bhudhiEconomicsSessions.estimated_cost_usd,
        })
        .from(bhudhiEconomicsSessions)
        .where(
          and(
            eq(bhudhiEconomicsSessions.user_id, userId),
            gte(bhudhiEconomicsSessions.created_at, since),
          ),
        );
    } catch {
      sessions = [];
    }

    let logCost = 0;
    let logCount = 0;
    try {
      const [agg] = await db
        .select({
          count: sql<number>`count(*)::int`,
          cost: sql<number>`coalesce(sum((${bhudhiLogs.output_json}->>'estimated_cost_usd')::float), 0)`,
        })
        .from(bhudhiLogs)
        .where(and(eq(bhudhiLogs.user_id, userId), gte(bhudhiLogs.created_at, since)));
      logCount = Number(agg?.count ?? 0);
      logCost = Number(agg?.cost ?? 0);
    } catch {
      logCost = 0;
      logCount = 0;
    }

    const requestCount = Math.max(sessions.length, logCount, 1);
    const totalCost =
      sessions.reduce((s, r) => s + (r.actual_cost_usd ?? r.estimated_cost_usd), 0) || logCost;

    const cacheHits = sessions.filter((s) => s.cache_hit).length;
    const routingDistribution: Record<string, number> = {};
    for (const s of sessions) {
      routingDistribution[s.execution_mode] = (routingDistribution[s.execution_mode] ?? 0) + 1;
    }

    const avgValue =
      sessions.length > 0
        ? sessions.reduce((s, r) => s + r.value_score, 0) / sessions.length
        : 0;

    const estimatedWaste = sessions.filter(
      (s) => s.value_score < 30 && !s.cache_hit,
    ).length;

    return {
      costPerRequest: totalCost / requestCount,
      costPerUser: totalCost,
      tokensToday: 0,
      cacheHitRate: sessions.length > 0 ? cacheHits / sessions.length : 0,
      wasteScore: sessions.length > 0 ? estimatedWaste / sessions.length : 0,
      avgValueScore: avgValue,
      routingDistribution: routingDistribution as EconomicsObservatoryMetrics["routingDistribution"],
    };
  }
}

export const economicsObservatory = new EconomicsObservatory();
