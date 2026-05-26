import {
  db,
  bhudhiEconomicsProfiles,
  bhudhiModelCapabilities,
  bhudhiEconomicsSessions,
  bhudhiEconomicsLogs,
  bhudhiEconomicsForecasts,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEFAULT_MODEL_CAPABILITIES } from "./contracts/modelCatalog.js";
import type { IntelligenceEconomicsPlan } from "./contracts/types.js";

export async function seedModelCapabilities(): Promise<number> {
  const now = new Date();
  for (const m of DEFAULT_MODEL_CAPABILITIES) {
    await db
      .insert(bhudhiModelCapabilities)
      .values({
        id: `cap_${m.provider}`,
        model_id: m.modelId,
        provider: m.provider,
        cost_per_million: m.costPerMillion,
        latency_ms: m.latencyMs,
        quality: m.quality,
        risk: m.risk,
        reliability: m.reliability,
        memory_fit: m.memoryFit,
        tool_fit: m.toolFit,
        simulation_fit: m.simulationFit,
        status: "active",
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: bhudhiModelCapabilities.id,
        set: {
          cost_per_million: m.costPerMillion,
          quality: m.quality,
          reliability: m.reliability,
          updated_at: now,
        },
      });
  }
  return DEFAULT_MODEL_CAPABILITIES.length;
}

export async function getOrCreateProfile(userId: string, blueprintId?: string) {
  const [existing] = await db
    .select()
    .from(bhudhiEconomicsProfiles)
    .where(eq(bhudhiEconomicsProfiles.user_id, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(bhudhiEconomicsProfiles)
    .values({
      user_id: userId,
      blueprint_id: blueprintId ?? null,
      daily_token_budget: 100_000,
      daily_usd_budget: 5,
      target_confidence: 0.8,
      execution_mode: "STANDARD",
    })
    .returning();

  return created!;
}

export async function recordEconomicsSession(
  userId: string,
  blueprintId: string | undefined,
  triggerType: string,
  plan: IntelligenceEconomicsPlan,
): Promise<string> {
  const [row] = await db
    .insert(bhudhiEconomicsSessions)
    .values({
      user_id: userId,
      blueprint_id: blueprintId ?? null,
      trigger_type: triggerType,
      execution_mode: plan.compute.executionMode,
      route: plan.compute.route,
      model_id: plan.compute.modelId,
      estimated_cost_usd: plan.compute.estimatedCostUsd * plan.confidenceCostMultiplier,
      estimated_latency_ms: plan.compute.estimatedLatencyMs,
      confidence_target: plan.confidenceTier,
      value_score: plan.compute.valueScore,
      cache_hit: plan.compute.useCache,
      roi_action: plan.roi.action,
      metadata: {
        tokenBudget: plan.tokenBudget,
        simulation: plan.simulation,
        memory: plan.memory,
      },
    })
    .returning({ id: bhudhiEconomicsSessions.id });

  return row!.id;
}

export async function finalizeSession(
  sessionId: string,
  actual: { costUsd: number; latencyMs: number; tokensIn: number; tokensOut: number },
): Promise<void> {
  await db
    .update(bhudhiEconomicsSessions)
    .set({
      actual_cost_usd: actual.costUsd,
      actual_latency_ms: actual.latencyMs,
      tokens_in: actual.tokensIn,
      tokens_out: actual.tokensOut,
    })
    .where(eq(bhudhiEconomicsSessions.id, sessionId));
}

export async function logEconomicsEvent(
  userId: string,
  sessionId: string | null,
  eventType: string,
  category: string,
  amountUsd: number,
  tokens: number,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(bhudhiEconomicsLogs).values({
    session_id: sessionId,
    user_id: userId,
    event_type: eventType,
    category,
    amount_usd: amountUsd,
    tokens,
    detail,
  });
}

export async function saveForecasts(
  userId: string,
  blueprintId: string | undefined,
  points: Array<{
    horizonDays: number;
    costUsd: number;
    tokens: number;
    requests: number;
    memoryMb: number;
    simulationHours: number;
    confidence: number;
  }>,
): Promise<void> {
  for (const p of points) {
    await db.insert(bhudhiEconomicsForecasts).values({
      user_id: userId,
      blueprint_id: blueprintId ?? null,
      horizon_days: p.horizonDays,
      forecast_cost_usd: p.costUsd,
      forecast_tokens: p.tokens,
      forecast_requests: p.requests,
      forecast_memory_mb: p.memoryMb,
      forecast_simulation_hours: p.simulationHours,
      confidence: p.confidence,
      payload: {},
    });
  }
}
