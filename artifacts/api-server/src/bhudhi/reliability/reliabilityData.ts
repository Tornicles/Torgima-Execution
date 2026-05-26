import {
  db,
  bhudhiReliabilityEvents,
  bhudhiIncidentLogs,
  bhudhiRollbackHistory,
  bhudhiRecoveryRecords,
  bhudhiSystemHealth,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type {
  IncidentRecord,
  RecoveryOutput,
  ReliabilityOutput,
  RollbackResult,
} from "./contracts/types.js";

export async function persistReliabilityCheck(
  output: ReliabilityOutput,
  blueprintId: string,
  resilienceScore: number,
  continuityMode: string,
): Promise<void> {
  await db.insert(bhudhiReliabilityEvents).values({
    blueprint_id: blueprintId,
    event_type: "check",
    severity: output.incidents?.[0]?.severity ?? "INFO",
    health: output.health,
    risk: output.risk,
    failure_probability: output.failureProbability,
    payload: {
      recommendedProtection: output.recommendedProtection,
      incidents: output.incidents,
    },
  });

  await db.insert(bhudhiSystemHealth).values({
    blueprint_id: blueprintId,
    resilience_score: resilienceScore,
    uptime: output.health,
    availability: 1 - output.failureProbability,
    continuity_mode: continuityMode,
    metrics: { risk: output.risk },
  });
}

export async function persistIncident(blueprintId: string, incident: IncidentRecord, confidence: number): Promise<void> {
  await db.insert(bhudhiIncidentLogs).values({
    blueprint_id: blueprintId,
    incident_id: incident.incidentId,
    severity: incident.status === "closed" ? "INFO" : "MAJOR",
    status: incident.status,
    owner: incident.owner,
    sla_hours: incident.sla,
    confidence,
    detail: { flow: "detect → classify → assign → contain → recover → close" },
  });
}

export async function persistRollback(blueprintId: string, rollback: RollbackResult): Promise<void> {
  await db.insert(bhudhiRollbackHistory).values({
    blueprint_id: blueprintId,
    target: rollback.target,
    mode: rollback.mode,
    preserved_history: rollback.preservedHistory,
    status: rollback.status,
    detail: { steps: rollback.steps },
  });
}

export async function persistRecovery(blueprintId: string, recovery: RecoveryOutput): Promise<void> {
  await db.insert(bhudhiRecoveryRecords).values({
    blueprint_id: blueprintId,
    strategy: recovery.strategy,
    confidence: recovery.confidence,
    estimated_recovery_minutes: recovery.estimatedRecovery,
    status: "pending",
    detail: {},
  });
}

export async function listReliabilityHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiReliabilityEvents)
    .where(eq(bhudhiReliabilityEvents.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiReliabilityEvents.created_at))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    health: r.health,
    risk: r.risk,
    failureProbability: r.failure_probability,
    createdAt: r.created_at,
  }));
}
