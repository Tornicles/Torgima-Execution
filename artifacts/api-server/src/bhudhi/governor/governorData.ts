import {
  db,
  bhudhiGovernorEvents,
  bhudhiGovernorAllocations,
  bhudhiGovernorRecovery,
  bhudhiGovernorHistory,
  bhudhiGovernorHealth,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { GovernorOutput, RecoveryResult, SystemHealth } from "./contracts/types.js";

export async function persistGovernorSession(
  output: GovernorOutput,
  input: { blueprintId: string },
  health: SystemHealth,
): Promise<void> {
  await db.insert(bhudhiGovernorHistory).values({
    blueprint_id: input.blueprintId,
    session_id: output.sessionId,
    priority_map: output.priorityMap as unknown as Record<string, unknown>,
    interventions: output.interventions,
    execution_plan: output.executionPlan,
  });

  await db.insert(bhudhiGovernorHealth).values({
    blueprint_id: input.blueprintId,
    quality: health.quality,
    drift: health.drift,
    latency_ms: health.latencyMs,
    coordination: health.coordination,
    efficiency: health.efficiency,
    system_health: health.systemHealth,
    metrics: { priorityTop: output.priorityMap.topPriority.subsystem },
  });

  for (const [resource, amount] of Object.entries(output.allocation.allocation)) {
    await db.insert(bhudhiGovernorAllocations).values({
      blueprint_id: input.blueprintId,
      resource_type: resource,
      allocated: amount,
      waste: output.allocation.waste,
      recommendation: output.allocation.recommendation,
      allocation_map: output.allocation.allocation,
    });
  }

  for (const i of output.interventions) {
    await db.insert(bhudhiGovernorEvents).values({
      blueprint_id: input.blueprintId,
      event_type: "intervention",
      subsystem: i.subsystem,
      action: i.type,
      priority_level: output.priorityMap.topPriority.priority,
      payload: { reason: i.reason, severity: i.severity },
    });
  }
}

export async function persistRecovery(
  blueprintId: string,
  recovery: RecoveryResult,
): Promise<void> {
  await db.insert(bhudhiGovernorRecovery).values({
    blueprint_id: blueprintId,
    recovery_mode: recovery.mode,
    target_subsystem: recovery.target,
    status: recovery.status,
    preserved_history: recovery.preservedHistory,
    detail: { steps: recovery.steps },
  });
}

export async function listGovernorHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiGovernorHistory)
    .where(eq(bhudhiGovernorHistory.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiGovernorHistory.created_at))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    priorityMap: r.priority_map,
    interventions: r.interventions,
    createdAt: r.created_at,
  }));
}

export async function getLatestHealth(blueprintId: string) {
  const rows = await db
    .select()
    .from(bhudhiGovernorHealth)
    .where(eq(bhudhiGovernorHealth.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiGovernorHealth.created_at))
    .limit(1);
  return rows[0] ?? null;
}
