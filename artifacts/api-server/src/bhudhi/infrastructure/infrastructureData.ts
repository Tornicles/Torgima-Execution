import {
  db,
  bhudhiInfraRuntime,
  bhudhiInfraCapacity,
  bhudhiInfraDeployments,
  bhudhiInfraEvents,
  bhudhiInfraHealth,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { InfrastructureOutput, RecoveryResult } from "./contracts/types.js";
import type { AllocationResult, RuntimeResult } from "./contracts/types.js";

export async function persistInfrastructureObserve(
  output: InfrastructureOutput,
  blueprintId: string,
  alloc: AllocationResult,
  observability: Record<string, unknown>,
): Promise<void> {
  if (output.runtime) {
    await db.insert(bhudhiInfraRuntime).values({
      blueprint_id: blueprintId,
      runtime_type: output.runtime.runtime,
      health: output.runtime.health,
      latency_ms: output.runtime.latencyMs,
      throughput: output.runtime.throughput,
      stability: output.runtime.stability,
      recommendation: output.runtime.recommendation,
      metrics: observability,
    });
  }

  await db.insert(bhudhiInfraCapacity).values({
    blueprint_id: blueprintId,
    cpu: alloc.allocated.cpu ?? 0,
    memory: alloc.allocated.memory ?? 0,
    gpu: alloc.allocated.gpu ?? 0,
    storage: alloc.allocated.storage ?? 0,
    network: alloc.allocated.network ?? 0,
    utilization: alloc.utilization,
    waste: alloc.waste,
  });

  await db.insert(bhudhiInfraDeployments).values({
    blueprint_id: blueprintId,
    strategy: output.deploymentPlan.strategy,
    status: "planned",
    rollback_available: output.deploymentPlan.rollbackAvailable,
    detail: { steps: output.deploymentPlan.steps },
  });

  await db.insert(bhudhiInfraEvents).values({
    blueprint_id: blueprintId,
    event_type: "observe",
    environment: output.environment,
    risk: output.risk,
    payload: { capacity: output.capacity, scale: output.scale },
  });

  await db.insert(bhudhiInfraHealth).values({
    blueprint_id: blueprintId,
    availability: output.runtime?.health ?? 0.5,
    load: alloc.utilization,
    error_rate: typeof observability.errors === "number" ? observability.errors : 0.01,
    latency_p99_ms: output.runtime?.latencyMs ?? 0,
    metrics: observability,
  });
}

export async function persistRecovery(blueprintId: string, recovery: RecoveryResult): Promise<void> {
  await db.insert(bhudhiInfraEvents).values({
    blueprint_id: blueprintId,
    event_type: "recover",
    environment: recovery.target,
    risk: 0.5,
    payload: { action: recovery.action, steps: recovery.steps },
  });
}

export async function listInfrastructureHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiInfraEvents)
    .where(eq(bhudhiInfraEvents.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiInfraEvents.created_at))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    environment: r.environment,
    risk: r.risk,
    createdAt: r.created_at,
  }));
}
