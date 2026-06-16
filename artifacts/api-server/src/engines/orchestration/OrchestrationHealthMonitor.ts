/**
 * DOC28 Task 4 — stuck / incomplete workflow detection and lock starvation repair.
 */

import { db, events } from "@workspace/db";
import { and, desc, eq, lte, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { EventTypes } from "../../types/eventContracts.js";
import { writeEvent } from "../../services/EventService.js";
import { releaseLock } from "./OrchestrationLock.js";
import { WORKFLOWS, type RegistryWorkflow } from "./WorkflowRegistry.js";

export const ORCHESTRATION_HEALTH_INTERVAL_MS = 10 * 60 * 1000;
export const STUCK_WORKFLOW_THRESHOLD_MS = 60 * 1000;
export const INCOMPLETE_WORKFLOW_THRESHOLD_MS = 5 * 60 * 1000;
export const LOCK_STARVATION_THRESHOLD_MS = 120 * 1000;

export type OrchestrationHealthFinding =
  | {
      kind: "stuck_workflow";
      blueprintId: string;
      triggerEvent: string;
      workflowName: string;
      secondsSinceTrigger: number;
    }
  | {
      kind: "incomplete_workflow";
      blueprintId: string;
      triggerEvent: string;
      workflowName: string;
      secondsSinceTrigger: number;
    }
  | {
      kind: "lock_starvation";
      blueprintId: string;
      lockKey: string;
      heldSeconds: number;
    };

export function evaluateStuckFeedbackLoop(params: {
  feedbackProcessedAt: Date;
  lastOrderAvailableAt: Date | null;
  blueprintId: string;
  now?: Date;
}): OrchestrationHealthFinding | null {
  const now = params.now ?? new Date();
  const elapsedMs = now.getTime() - params.feedbackProcessedAt.getTime();
  if (elapsedMs < STUCK_WORKFLOW_THRESHOLD_MS) return null;

  if (
    params.lastOrderAvailableAt &&
    params.lastOrderAvailableAt.getTime() >= params.feedbackProcessedAt.getTime()
  ) {
    return null;
  }

  return {
    kind: "stuck_workflow",
    blueprintId: params.blueprintId,
    triggerEvent: EventTypes.FEEDBACK_SUBMITTED,
    workflowName: WORKFLOWS.FEEDBACK_COMPLETION.name,
    secondsSinceTrigger: Math.floor(elapsedMs / 1000),
  };
}

export function evaluateIncompleteWorkflow(params: {
  triggerProcessedAt: Date;
  terminalSeen: boolean;
  blueprintId: string;
  triggerEvent: string;
  workflow: RegistryWorkflow;
  now?: Date;
}): OrchestrationHealthFinding | null {
  const now = params.now ?? new Date();
  const elapsedMs = now.getTime() - params.triggerProcessedAt.getTime();
  if (elapsedMs < INCOMPLETE_WORKFLOW_THRESHOLD_MS) return null;
  if (params.terminalSeen) return null;

  return {
    kind: "incomplete_workflow",
    blueprintId: params.blueprintId,
    triggerEvent: params.triggerEvent,
    workflowName: params.workflow.name,
    secondsSinceTrigger: Math.floor(elapsedMs / 1000),
  };
}

export function evaluateLockStarvation(params: {
  lockCreatedAt: Date;
  blueprintId: string;
  lockKey: string;
  now?: Date;
}): OrchestrationHealthFinding | null {
  const now = params.now ?? new Date();
  const elapsedMs = now.getTime() - params.lockCreatedAt.getTime();
  if (elapsedMs < LOCK_STARVATION_THRESHOLD_MS) return null;

  return {
    kind: "lock_starvation",
    blueprintId: params.blueprintId,
    lockKey: params.lockKey,
    heldSeconds: Math.floor(elapsedMs / 1000),
  };
}

async function latestProcessedEvent(
  blueprintId: string,
  eventTypes: string[],
): Promise<{ processed_at: Date | null; event_type: string } | undefined> {
  const rows = await db
    .select({
      processed_at: events.processed_at,
      event_type: events.event_type,
    })
    .from(events)
    .where(
      and(
        eq(events.blueprint_id, blueprintId),
        inArray(events.event_type, eventTypes),
        eq(events.status, "processed"),
      ),
    )
    .orderBy(desc(events.processed_at))
    .limit(1);

  return rows[0];
}

async function findStuckFeedbackBlueprints(now: Date): Promise<OrchestrationHealthFinding[]> {
  const cutoff = new Date(now.getTime() - STUCK_WORKFLOW_THRESHOLD_MS);
  const triggerTypes = WORKFLOWS.FEEDBACK_COMPLETION.triggerEvents;

  const triggers = await db
    .select({
      blueprint_id: events.blueprint_id,
      processed_at: events.processed_at,
      event_type: events.event_type,
    })
    .from(events)
    .where(
      and(
        inArray(events.event_type, [...triggerTypes]),
        eq(events.status, "processed"),
        lte(events.processed_at, cutoff),
      ),
    )
    .limit(100);

  const findings: OrchestrationHealthFinding[] = [];

  for (const row of triggers) {
    if (!row.blueprint_id || !row.processed_at) continue;

    const terminal = await latestProcessedEvent(row.blueprint_id, [
      ...WORKFLOWS.FEEDBACK_COMPLETION.terminalEvents,
    ]);

    const finding = evaluateStuckFeedbackLoop({
      feedbackProcessedAt: row.processed_at,
      lastOrderAvailableAt: terminal?.processed_at ?? null,
      blueprintId: row.blueprint_id,
      now,
    });

    if (finding) findings.push(finding);
  }

  return findings;
}

async function findStarvedLocks(now: Date): Promise<OrchestrationHealthFinding[]> {
  const cutoff = new Date(now.getTime() - LOCK_STARVATION_THRESHOLD_MS);

  const locks = await db
    .select({
      blueprint_id: events.blueprint_id,
      created_at: events.created_at,
      idempotency_key: events.idempotency_key,
    })
    .from(events)
    .where(
      and(
        eq(events.event_type, EventTypes.ORCHESTRATION_LOCK),
        eq(events.status, "claimed"),
        lte(events.created_at, cutoff),
      ),
    )
    .limit(50);

  const findings: OrchestrationHealthFinding[] = [];
  for (const lock of locks) {
    if (!lock.blueprint_id || !lock.idempotency_key) continue;
    const finding = evaluateLockStarvation({
      lockCreatedAt: lock.created_at,
      blueprintId: lock.blueprint_id,
      lockKey: lock.idempotency_key,
      now,
    });
    if (finding) findings.push(finding);
  }
  return findings;
}

async function emitFinding(finding: OrchestrationHealthFinding): Promise<void> {
  if (finding.kind === "stuck_workflow") {
    await writeEvent({
      eventType: EventTypes.WORKFLOW_STUCK_DETECTED,
      entityType: "blueprint",
      entityId: finding.blueprintId,
      blueprintId: finding.blueprintId,
      payload: {
        workflowName: finding.workflowName,
        triggerEvent: finding.triggerEvent,
        secondsSinceTrigger: finding.secondsSinceTrigger,
      },
    });
    await writeEvent({
      eventType: EventTypes.ORCHESTRATION_REPAIR_REQUESTED,
      entityType: "blueprint",
      entityId: finding.blueprintId,
      blueprintId: finding.blueprintId,
      payload: {
        reason: "stuck_workflow",
        workflowName: finding.workflowName,
      },
    });
    return;
  }

  if (finding.kind === "incomplete_workflow") {
    await writeEvent({
      eventType: EventTypes.WORKFLOW_INCOMPLETE,
      entityType: "blueprint",
      entityId: finding.blueprintId,
      blueprintId: finding.blueprintId,
      payload: {
        workflowName: finding.workflowName,
        triggerEvent: finding.triggerEvent,
        secondsSinceTrigger: finding.secondsSinceTrigger,
      },
    });
    await writeEvent({
      eventType: EventTypes.DEAD_LETTER_REVIEW_REQUESTED,
      entityType: "blueprint",
      entityId: finding.blueprintId,
      blueprintId: finding.blueprintId,
      payload: { reason: "workflow_incomplete", workflowName: finding.workflowName },
    });
    return;
  }

  const parts = finding.lockKey.split(":");
  const blueprintId = finding.blueprintId;
  const workflowName = parts[parts.length - 1] ?? "feedback_completion";

  await releaseLock("BLUEPRINT", blueprintId, workflowName);
  await writeEvent({
    eventType: EventTypes.SYSTEM_HEALTH_DEGRADED,
    entityType: "blueprint",
    entityId: blueprintId,
    blueprintId,
    payload: {
      reason: "orchestration_lock_starvation",
      lockKey: finding.lockKey,
      heldSeconds: finding.heldSeconds,
    },
  });
  await writeEvent({
    eventType: EventTypes.ORCHESTRATION_REPAIR_REQUESTED,
    entityType: "blueprint",
    entityId: blueprintId,
    blueprintId,
    payload: {
      reason: "lock_starvation",
      workflowName,
    },
  });
}

export class OrchestrationHealthMonitor {
  static async runCycle(now = new Date()): Promise<{
    findings: OrchestrationHealthFinding[];
    repairsTriggered: number;
  }> {
    const findings = [
      ...(await findStuckFeedbackBlueprints(now)),
      ...(await findStarvedLocks(now)),
    ];

    for (const finding of findings) {
      await emitFinding(finding).catch((err) => {
        logger.warn({ err, finding }, "[OrchestrationHealthMonitor] emit failed");
      });
    }

    logger.info(
      { findings: findings.length, repairsTriggered: findings.length },
      "[OrchestrationHealthMonitor] Cycle complete",
    );

    return { findings, repairsTriggered: findings.length };
  }
}
