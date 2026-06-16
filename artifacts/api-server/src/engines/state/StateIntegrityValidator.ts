/**
 * DOC 17 — state integrity checks (Phase 2 canonical path).
 */

import {
  db,
  blueprints,
  blueprintVersions,
  conditions,
  enforcementPackages,
  orders,
  events,
  systemHealthLogs,
} from "@workspace/db";
import { and, eq, inArray, lt, sql, desc } from "drizzle-orm";
import { BlueprintStatus, EventStatus, OrderStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import {
  getIntegrityChecker,
  type IntegrityChecker,
} from "../health/IntegrityChecker.js";
import { runStateIntegrityEngine } from "../execution-loop/StateIntegrityEngine.js";
import type { HealthFinding } from "../../services/SystemHealthService.js";

export interface IntegrityCheckResult {
  ok: boolean;
  findings: HealthFinding[];
  checksRun: number;
}

export class StateIntegrityValidator {
  constructor(private readonly checker: IntegrityChecker = getIntegrityChecker()) {}

  async runAllChecks(): Promise<IntegrityCheckResult> {
    const engineResult = await runStateIntegrityEngine();
    const findings: HealthFinding[] = [
      ...(await this.checker.runAllChecks()),
      ...engineResult.findings,
      ...(await this.checkBlueprintConditionAlignment()),
      ...(await this.checkEnforcementPackageFreshness()),
      ...(await this.checkActiveOrderCountVsEnforcement()),
      ...(await this.checkStuckPendingEvents()),
      ...(await this.checkStateVersionMonotonic()),
    ];

    const hasCritical = findings.some((f) => f.severity === "CRITICAL" || f.severity === "FATAL");
    const hasConditionMismatch = findings.some((f) => f.issueCode === "BLUEPRINT_CONDITION_MISMATCH");

    if (hasConditionMismatch) {
      await this.emitConditionMismatchEscalation(findings);
    }

    if (findings.length === 0) {
      await db
        .insert(systemHealthLogs)
        .values({
          area: "STATE_INTEGRITY",
          severity: "INFO",
          check_type: "state_integrity_validator",
          message: "All state integrity checks passed",
          status: "ok",
          details_json: { checks_run: 7 + engineResult.checksRun },
        })
        .catch(() => null);
    }

    logger.info(
      { findings: findings.length, critical: hasCritical },
      "[StateIntegrityValidator] runAllChecks complete",
    );

    return {
      ok: !hasCritical,
      findings,
      checksRun: 7 + engineResult.checksRun,
    };
  }

  /** blueprint.current_condition must match latest is_current condition row. */
  async checkBlueprintConditionAlignment(): Promise<HealthFinding[]> {
    const rows = await db
      .select({
        blueprintId: blueprints.id,
        userId: blueprints.user_id,
        blueprintCondition: blueprints.current_condition,
        conditionRow: conditions.condition,
      })
      .from(blueprints)
      .innerJoin(
        conditions,
        and(eq(conditions.blueprint_id, blueprints.id), eq(conditions.is_current, true)),
      )
      .where(and(eq(blueprints.active, true), eq(blueprints.status, BlueprintStatus.ACTIVE)));

    const findings: HealthFinding[] = [];
    for (const row of rows) {
      const bpCond = String(row.blueprintCondition ?? "").toLowerCase();
      const condRow = String(row.conditionRow ?? "").toLowerCase();
      if (bpCond && condRow && bpCond !== condRow) {
        findings.push({
          area: "EXECUTION_LOOP",
          severity: "CRITICAL",
          issueCode: "BLUEPRINT_CONDITION_MISMATCH",
          blueprintId: row.blueprintId,
          userId: row.userId,
          entityType: "blueprint",
          entityId: row.blueprintId,
          expected: `blueprint.current_condition = ${condRow}`,
          actual: `blueprint.current_condition = ${bpCond}`,
          repairable: false,
          repairAction: "ADMIN_REVIEW",
        });
      }
    }
    return findings;
  }

  /** Active blueprint must have enforcement package created after last condition entry. */
  async checkEnforcementPackageFreshness(): Promise<HealthFinding[]> {
    const findings: HealthFinding[] = [];

    const active = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .where(and(eq(blueprints.active, true), eq(blueprints.status, BlueprintStatus.ACTIVE)));

    for (const bp of active) {
      const [cond] = await db
        .select({ entered_at: conditions.entered_at })
        .from(conditions)
        .where(and(eq(conditions.blueprint_id, bp.id), eq(conditions.is_current, true)))
        .orderBy(desc(conditions.entered_at))
        .limit(1);

      const [pkg] = await db
        .select({ id: enforcementPackages.id, created_at: enforcementPackages.created_at })
        .from(enforcementPackages)
        .where(
          and(eq(enforcementPackages.blueprint_id, bp.id), eq(enforcementPackages.is_current, true)),
        )
        .limit(1);

      if (!cond) continue;
      if (!pkg || pkg.created_at < cond.entered_at) {
        findings.push({
          area: "CONTROL",
          severity: "ERROR",
          issueCode: "ENFORCEMENT_STALE_AFTER_CONDITION",
          blueprintId: bp.id,
          userId: bp.user_id,
          entityType: "blueprint",
          entityId: bp.id,
          expected: "Current enforcement package after last condition transition",
          actual: pkg ? "Enforcement package predates current condition" : "No current enforcement package",
          repairable: true,
          repairAction: "REGENERATE_TASK",
        });
      }
    }

    return findings;
  }

  /** Pending order count must not exceed enforcement task_limits.max. */
  async checkActiveOrderCountVsEnforcement(): Promise<HealthFinding[]> {
    const findings: HealthFinding[] = [];

    const packages = await db
      .select({
        blueprintId: enforcementPackages.blueprint_id,
        taskLimits: enforcementPackages.task_limits,
      })
      .from(enforcementPackages)
      .where(eq(enforcementPackages.is_current, true));

    for (const pkg of packages) {
      const limits = pkg.taskLimits as { min?: number; max?: number } | null;
      const max = limits?.max ?? 8;

      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.blueprint_id, pkg.blueprintId),
            inArray(orders.status, [OrderStatus.PENDING, OrderStatus.ACTIVE]),
          ),
        );

      if ((count ?? 0) > max) {
        findings.push({
          area: "TASK_QUEUE",
          severity: "ERROR",
          issueCode: "ORDER_COUNT_EXCEEDS_ENFORCEMENT",
          blueprintId: pkg.blueprintId,
          entityType: "blueprint",
          entityId: pkg.blueprintId,
          expected: `<= ${max} pending/active orders`,
          actual: `${count} orders`,
          repairable: true,
          repairAction: "REGENERATE_TASK",
        });
      }
    }

    return findings;
  }

  /** PENDING events older than 5 minutes (DOC 17). */
  async checkStuckPendingEvents(): Promise<HealthFinding[]> {
    const threshold = new Date(Date.now() - 5 * 60 * 1000);
    const stuck = await db
      .select({
        id: events.id,
        blueprintId: events.blueprint_id,
        eventType: events.event_type,
        createdAt: events.created_at,
      })
      .from(events)
      .where(
        and(
          inArray(events.status, [EventStatus.PENDING, EventStatus.RETRY_PENDING]),
          lt(events.created_at, threshold),
        ),
      )
      .limit(50);

    if (stuck.length === 0) return [];

    await writeEvent({
      eventType: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
      entityType: "system",
      entityId: "event_integrity",
      payload: {
        reason: "integrity_violation_detected",
        stuck_pending_count: stuck.length,
      },
      idempotencyKey: `integrity_stuck_events:${Math.floor(Date.now() / 300000)}`,
    }).catch(() => null);

    return [
      {
        area: "EVENT_SYSTEM",
        severity: stuck.length > 10 ? "CRITICAL" : "ERROR",
        issueCode: "STUCK_PENDING_EVENTS",
        expected: "No PENDING events older than 5 minutes",
        actual: `${stuck.length} stuck event(s)`,
        repairable: true,
        repairAction: "RETRY_EVENT",
      },
    ];
  }

  /** No duplicate version_number per blueprint in blueprint_versions. */
  async checkStateVersionMonotonic(): Promise<HealthFinding[]> {
    const dupes = await db
      .select({
        blueprintId: blueprintVersions.blueprint_id,
        versionNumber: blueprintVersions.version_number,
        cnt: sql<number>`count(*)::int`,
      })
      .from(blueprintVersions)
      .groupBy(blueprintVersions.blueprint_id, blueprintVersions.version_number)
      .having(sql`count(*) > 1`);

    return dupes.map((row) => ({
      area: "STATE_VERSION",
      severity: "CRITICAL",
      issueCode: "DUPLICATE_BLUEPRINT_VERSION",
      blueprintId: row.blueprintId,
      entityType: "blueprint",
      entityId: row.blueprintId,
      expected: "Unique version_number per blueprint",
      actual: `version ${row.versionNumber} appears ${row.cnt} times`,
      repairable: false,
      repairAction: "ADMIN_REVIEW",
    }));
  }

  private async emitConditionMismatchEscalation(findings: HealthFinding[]): Promise<void> {
    const mismatches = findings.filter((f) => f.issueCode === "BLUEPRINT_CONDITION_MISMATCH");
    for (const f of mismatches) {
      if (!f.blueprintId || !f.userId) continue;
      await writeEvent({
        eventType: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
        entityType: "blueprint",
        entityId: f.blueprintId,
        userId: f.userId,
        blueprintId: f.blueprintId,
        payload: {
          reason: "condition_blueprint_mismatch",
          issue_code: f.issueCode,
          pause_task_generation: true,
        },
        idempotencyKey: `health_degraded:condition_mismatch:${f.blueprintId}:${Date.now()}`,
      }).catch(() => null);
    }
  }
}

export async function runStateIntegrityValidation(): Promise<IntegrityCheckResult> {
  return new StateIntegrityValidator().runAllChecks();
}
