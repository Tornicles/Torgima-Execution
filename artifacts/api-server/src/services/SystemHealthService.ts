import {
  db,
  blueprints,
  events,
  deadLetterEvents,
  feedback,
  signalSnapshots,
  orders,
  systemHealthLogs,
  validations,
} from "@workspace/db";
import { and, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "./EventService.js";
import {
  BlueprintStatus,
  EventStatus,
  OrderStatus,
  SystemHealthStatus,
  ValidationStatus,
} from "@workspace/state-machine";

// SystemHealthService — runs integrity checks across the execution chain, classifies
// findings, writes SystemHealthLog records, emits system_health_degraded, and
// dispatches auto-repair events where allowed.
//
// Spec: Prompt 6 §STEP 4, DOC_17 §6–13, §17.

export type HealthArea =
  | "DATABASE"
  | "STATE_VERSION"
  | "EXECUTION_LOOP"
  | "EVENT_SYSTEM"
  | "TASK_QUEUE"
  | "SIGNAL_CONDITION"
  | "SIGNAL_CHAIN"
  | "CONDITION_CHAIN"
  | "CONTROL"
  | "CONTROL_CHAIN"
  | "FRONTEND_SYNC"
  | "PROJECTION"
  | "BHUDHI"
  | "WORKER_RUNTIME"
  | "WORKER_HEALTH"
  | "AI_SYSTEM"
  | "VALIDATION";

export type HealthSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL" | "FATAL";

export type HealthRepairAction =
  | "NONE"
  | "REGENERATE_TASK"
  | "RECALCULATE_SIGNAL"
  | "REFRESH_PROJECTION"
  | "RETRY_EVENT"
  | "ADMIN_REVIEW";

export interface HealthFinding {
  area: HealthArea;
  severity: HealthSeverity;
  issueCode: string;
  userId?: string;
  blueprintId?: string;
  entityType?: string;
  entityId?: string;
  expected: string;
  actual: string;
  repairable: boolean;
  repairAction: HealthRepairAction;
}

// ── INTEGRITY CHECKS ─────────────────────────────────────────────────────────

export async function runIntegrityChecks(): Promise<HealthFinding[]> {
  const { runIntegrityCheckerChecks } = await import(
    "../engines/health/IntegrityChecker.js"
  );
  const findings: HealthFinding[] = await runIntegrityCheckerChecks();

  const checks = [
    checkDeadLetterBlockers,
    checkSignalChainContinuity,
    checkProjectionFreshness,
    checkValidationPipeline,
  ];

  for (const check of checks) {
    try {
      const result = await check();
      findings.push(...result);
    } catch (error) {
      logger.error(
        {
          check: check.name,
          error: error instanceof Error ? error.message : String(error),
        },
        "[HealthService] Integrity check threw",
      );
    }
  }

  return findings;
}

// Check 1 — Every active blueprint must have at least one pending/active task.
async function checkActiveBlueprintsHaveTasks(): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [];

  const activeBlueprints = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, BlueprintStatus.ACTIVE)));

  for (const bp of activeBlueprints) {
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(eq(orders.blueprint_id, bp.id), inArray(orders.status, [OrderStatus.PENDING, OrderStatus.ACTIVE])),
      );

    if ((count ?? 0) === 0) {
      findings.push({
        area: "TASK_QUEUE",
        severity: "ERROR",
        issueCode: "ACTIVE_BLUEPRINT_EMPTY",
        userId: bp.user_id,
        blueprintId: bp.id,
        entityType: "blueprint",
        entityId: bp.id,
        expected: "At least 1 pending or active task",
        actual: "0 tasks",
        repairable: true,
        repairAction: "REGENERATE_TASK",
      });
    }
  }

  return findings;
}

// Check 2 — Event backlog: pending events older than 5 minutes.
async function checkEventBacklog(): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [];
  const threshold = new Date(Date.now() - 5 * 60 * 1000);

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.status, EventStatus.PENDING), lt(events.process_after, threshold)));

  const stuckCount = count ?? 0;

  if (stuckCount > 10) {
    findings.push({
      area: "EVENT_SYSTEM",
      severity: stuckCount > 50 ? "CRITICAL" : "WARN",
      issueCode: "EVENT_BACKLOG_HIGH",
      expected: "< 10 pending events older than 5 minutes",
      actual: `${stuckCount} stuck events`,
      repairable: true,
      repairAction: "RETRY_EVENT",
    });
  }

  return findings;
}

// Check 3 — Critical events that ended up in the dead-letter queue.
async function checkDeadLetterBlockers(): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [];

  const criticalDLQ = await db
    .select({
      id: deadLetterEvents.id,
      event_type: deadLetterEvents.event_type,
      blueprint_id: deadLetterEvents.blueprint_id,
      user_id: deadLetterEvents.user_id,
      created_at: deadLetterEvents.created_at,
    })
    .from(deadLetterEvents)
    .where(eq(deadLetterEvents.resolved, false))
    .limit(20);

  const criticalTypes = new Set([
    "feedback_submitted",
    "signal_recalculation_requested",
    "condition_evaluated",
    "enforcement_package_requested",
    "task_generation_requested",
  ]);

  for (const dlq of criticalDLQ) {
    if (!criticalTypes.has(dlq.event_type)) continue;
    findings.push({
      area: "EVENT_SYSTEM",
      severity: "ERROR",
      issueCode: "CRITICAL_DLQ_BLOCKER",
      blueprintId: dlq.blueprint_id ?? undefined,
      userId: dlq.user_id ?? undefined,
      entityType: "dead_letter_event",
      entityId: dlq.id,
      expected: "Critical execution events must not dead-letter",
      actual: `${dlq.event_type} dead-lettered at ${dlq.created_at.toISOString()}`,
      repairable: false,
      repairAction: "ADMIN_REVIEW",
    });
  }

  return findings;
}

// Check 4 — Signal-chain continuity: accepted feedback in the last 30 minutes
// must be followed by a signal snapshot.
async function checkSignalChainContinuity(): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [];
  const lookback = new Date(Date.now() - 30 * 60 * 1000);

  const recentFeedback = await db
    .select({
      id: feedback.id,
      blueprint_id: feedback.blueprint_id,
      user_id: feedback.user_id,
      created_at: feedback.created_at,
    })
    .from(feedback)
    .where(and(gt(feedback.created_at, lookback), eq(feedback.validity, "valid")))
    .limit(10);

  for (const fb of recentFeedback) {
    const [signal] = await db
      .select({ id: signalSnapshots.id })
      .from(signalSnapshots)
      .where(
        and(
          eq(signalSnapshots.blueprint_id, fb.blueprint_id),
          gt(signalSnapshots.created_at, fb.created_at),
        ),
      )
      .limit(1);

    if (!signal) {
      findings.push({
        area: "SIGNAL_CHAIN",
        severity: "WARN",
        issueCode: "FEEDBACK_NO_SIGNAL_CHAIN",
        blueprintId: fb.blueprint_id,
        userId: fb.user_id,
        entityType: "feedback",
        entityId: fb.id,
        expected: "Signal recalculated after feedback accepted",
        actual: "No signal snapshot found after feedback",
        repairable: true,
        repairAction: "RECALCULATE_SIGNAL",
      });
    }
  }

  return findings;
}

// Check 5 — Projection freshness placeholder. Full implementation lands when
// the dashboard projection store is introduced (Prompt 15+).
async function checkProjectionFreshness(): Promise<HealthFinding[]> {
  return [];
}

/** Prompt 8 — Erector validation pipeline stuck / abandoned detection. */
async function checkValidationPipeline(): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [];
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [stuckRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(validations)
    .where(
      and(
        eq(validations.validation_stage, ValidationStatus.RUNNING),
        lt(validations.updated_at, fiveMinAgo),
      ),
    );

  const [abandonedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(blueprints)
    .where(
      and(
        eq(blueprints.status, BlueprintStatus.PATH_SELECTION),
        lt(blueprints.updated_at, fortyEightHoursAgo),
      ),
    );

  const stuckValidations = stuckRow?.count ?? 0;
  const abandonedValidations = abandonedRow?.count ?? 0;
  const score = stuckValidations === 0 ? 10 : 5;
  const status = stuckValidations > 0 ? "warn" : "ok";

  await db
    .insert(systemHealthLogs)
    .values({
      area: "VALIDATION",
      severity: stuckValidations > 0 ? "WARN" : "INFO",
      check_type: "validation_pipeline",
      message:
        stuckValidations > 0
          ? `${stuckValidations} validation(s) stuck in running > 5 minutes`
          : "Validation pipeline healthy",
      status,
      score,
      details_json: { stuckValidations, abandonedValidations },
      issues_detected:
        stuckValidations > 0 ? ["VALIDATION_PIPELINE_STUCK"] : [],
    })
    .catch(() => null);

  if (stuckValidations > 0) {
    findings.push({
      area: "VALIDATION",
      severity: "WARN",
      issueCode: "VALIDATION_PIPELINE_STUCK",
      expected: "No Erector validation stuck in running > 5 minutes",
      actual: `${stuckValidations} validation row(s) stale`,
      repairable: false,
      repairAction: "ADMIN_REVIEW",
    });
  }

  if (abandonedValidations > 0) {
    findings.push({
      area: "VALIDATION",
      severity: "INFO",
      issueCode: "VALIDATION_PATH_SELECTION_STALE",
      expected: "Blueprints in path_selection should progress within 48 hours",
      actual: `${abandonedValidations} blueprint(s) idle > 48 hours`,
      repairable: false,
      repairAction: "NONE",
    });
  }

  return findings;
}

// ── PROCESS AND LOG FINDINGS ─────────────────────────────────────────────────

export async function processFindings(findings: HealthFinding[]): Promise<void> {
  for (const finding of findings) {
    // Deduplicate against an open log for the same issueCode/blueprint
    const openStatus =
      finding.severity === "CRITICAL" || finding.severity === "FATAL" ? "OPEN" : "degraded";

    const [existing] = await db
      .select({ id: systemHealthLogs.id })
      .from(systemHealthLogs)
      .where(
        and(
          eq(systemHealthLogs.check_type, finding.issueCode),
          inArray(systemHealthLogs.status, ["OPEN", SystemHealthStatus.DEGRADED, "IN_PROGRESS"]),
          finding.blueprintId
            ? eq(systemHealthLogs.blueprint_id, finding.blueprintId)
            : sql`${systemHealthLogs.blueprint_id} is null`,
        ),
      )
      .limit(1);

    if (existing) continue;

    const message = `${finding.expected} — ${finding.actual}`;

    await db
      .insert(systemHealthLogs)
      .values({
        area: finding.area,
        severity: finding.severity,
        blueprint_id: finding.blueprintId,
        user_id: finding.userId,
        entity_type: finding.entityType,
        entity_id: finding.entityId,
        check_type: finding.issueCode,
        message,
        status: openStatus,
        details_json: finding as unknown as Record<string, unknown>,
        issues_detected: [finding.issueCode],
      })
      .catch(() => null);

    if (["WARN", "ERROR", "CRITICAL", "FATAL"].includes(finding.severity)) {
      await writeEvent({
        eventType: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
        entityType: finding.entityType ?? "system",
        entityId: finding.entityId,
        userId: finding.userId,
        blueprintId: finding.blueprintId,
        payload: {
          area: finding.area,
          severity: finding.severity,
          issue_code: finding.issueCode,
          repair_action: finding.repairAction,
          expected: finding.expected,
          actual: finding.actual,
        },
        idempotencyKey: `health:${finding.issueCode}:${finding.blueprintId ?? "system"}:${Math.floor(
          Date.now() / 300000,
        )}`,
      }).catch(() => null);
    }

    if (finding.repairable) await attemptAutoRepair(finding);

    logger.warn(
      {
        issueCode: finding.issueCode,
        severity: finding.severity,
        blueprintId: finding.blueprintId,
        repairAction: finding.repairAction,
      },
      "[HealthService] Issue detected",
    );
  }
}

// ── AUTO-REPAIR ──────────────────────────────────────────────────────────────

async function attemptAutoRepair(finding: HealthFinding): Promise<void> {
  try {
    switch (finding.repairAction) {
      case "REGENERATE_TASK":
        if (finding.blueprintId && finding.userId) {
          await writeEvent({
            eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
            entityType: "blueprint",
            entityId: finding.blueprintId,
            userId: finding.userId,
            blueprintId: finding.blueprintId,
            payload: { generation_mode: "recovery", generation_trigger: "health_repair" },
            idempotencyKey: `health_repair_task:${finding.blueprintId}:${Date.now()}`,
          });
          logger.info(
            { blueprintId: finding.blueprintId },
            "[HealthService] Auto-repair: task regeneration requested",
          );
        }
        break;

      case "RECALCULATE_SIGNAL":
        if (finding.blueprintId && finding.userId) {
          await writeEvent({
            eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
            entityType: "blueprint",
            entityId: finding.blueprintId,
            userId: finding.userId,
            blueprintId: finding.blueprintId,
            payload: { trigger: "health_repair" },
            idempotencyKey: `health_repair_signal:${finding.blueprintId}:${Date.now()}`,
          });
        }
        break;

      case "REFRESH_PROJECTION":
        if (finding.blueprintId && finding.userId) {
          await writeEvent({
            eventType: EVENT_TYPES.PROJECTION_REFRESH_REQUESTED,
            entityType: "blueprint",
            entityId: finding.blueprintId,
            userId: finding.userId,
            blueprintId: finding.blueprintId,
            payload: {},
            idempotencyKey: `health_repair_proj:${finding.blueprintId}:${Date.now()}`,
          });
        }
        break;

      default:
        break;
    }
  } catch (error) {
    logger.error(
      {
        issueCode: finding.issueCode,
        repairAction: finding.repairAction,
        error: error instanceof Error ? error.message : String(error),
      },
      "[HealthService] Auto-repair failed",
    );
  }
}

// ── USER-FACING HEALTH PROJECTION ────────────────────────────────────────────

export async function getUserFacingHealthState(userId: string): Promise<{
  systemOperational: boolean;
  executionAvailable: boolean;
  message?: string;
}> {
  void userId; // placeholder for per-user scoping when projection store lands
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(systemHealthLogs)
    .where(
      and(
        inArray(systemHealthLogs.status, ["OPEN", SystemHealthStatus.DEGRADED]),
        or(
          inArray(systemHealthLogs.severity, ["CRITICAL", "FATAL"]),
          inArray(systemHealthLogs.check_type, ["FATAL", "CRITICAL"]),
        ),
      ),
    );

  const criticalIssues = count ?? 0;

  return {
    systemOperational: criticalIssues === 0,
    executionAvailable: criticalIssues === 0,
    message:
      criticalIssues > 0
        ? "Some features are temporarily unavailable. Your progress is preserved."
        : undefined,
  };
}
