/**
 * DOC17 Task 1 — eight scheduled integrity checks.
 */

import {
  db,
  blueprints,
  orders,
  feedback,
  signalSnapshots,
  conditions,
  enforcementPackages,
  events,
} from "@workspace/db";
import { and, eq, gt, inArray, isNull, lt, not, or, sql } from "drizzle-orm";
import { BlueprintStatus, EventStatus, OrderStatus } from "@workspace/state-machine";
import type { HealthFinding } from "../../services/SystemHealthService.js";
import { logger } from "../../lib/logger.js";

export interface StateIntegrityResult {
  ok: boolean;
  findings: HealthFinding[];
  checksRun: number;
}

const ACTIVE_ORDER_STATUSES = [OrderStatus.PENDING, OrderStatus.ACTIVE] as const;

export class StateIntegrityEngine {
  async runAllChecks(): Promise<StateIntegrityResult> {
    const findings: HealthFinding[] = [
      ...(await this.checkOrphanTask()),
      ...(await this.checkMissingCurrentSignal()),
      ...(await this.checkMissingCurrentCondition()),
      ...(await this.checkMissingCurrentEnforcement()),
      ...(await this.checkTaskWithoutBlueprintLink()),
      ...(await this.checkFeedbackWithoutSignalEvent()),
      ...(await this.checkDoubleActiveOrder()),
      ...(await this.checkStaleStateVersion()),
    ];

    logger.info(
      { findings: findings.length, critical: findings.filter((f) => f.severity === "CRITICAL").length },
      "[StateIntegrityEngine] Checks complete",
    );

    return {
      ok: !findings.some((f) => f.severity === "CRITICAL" || f.severity === "FATAL"),
      findings,
      checksRun: 8,
    };
  }

  /** CHECK 1 — active orders on inactive / missing blueprints. */
  async checkOrphanTask(): Promise<HealthFinding[]> {
    const rows = await db
      .select({
        orderId: orders.id,
        blueprintId: orders.blueprint_id,
        userId: orders.user_id,
        bpStatus: blueprints.status,
        bpActive: blueprints.active,
      })
      .from(orders)
      .leftJoin(blueprints, eq(orders.blueprint_id, blueprints.id))
      .where(
        and(
          inArray(orders.status, [...ACTIVE_ORDER_STATUSES]),
          or(
            isNull(orders.blueprint_id),
            isNull(blueprints.id),
            not(eq(blueprints.status, BlueprintStatus.ACTIVE)),
            eq(blueprints.active, false),
          ),
        ),
      )
      .limit(50);

    return rows.map((row) => ({
      area: "EXECUTION_LOOP",
      severity: "ERROR",
      issueCode: "ORPHAN_TASK",
      blueprintId: row.blueprintId ?? undefined,
      userId: row.userId,
      entityType: "order",
      entityId: row.orderId,
      expected: "Active orders linked to an active blueprint",
      actual: `Order on blueprint status=${row.bpStatus ?? "missing"} active=${String(row.bpActive)}`,
      repairable: true,
      repairAction: "REGENERATE_TASK",
    }));
  }

  /** CHECK 2 — active blueprint without current signal snapshot. */
  async checkMissingCurrentSignal(): Promise<HealthFinding[]> {
    const rows = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .leftJoin(
        signalSnapshots,
        and(
          eq(signalSnapshots.blueprint_id, blueprints.id),
          eq(signalSnapshots.is_current, true),
        ),
      )
      .where(
        and(
          eq(blueprints.active, true),
          eq(blueprints.status, BlueprintStatus.ACTIVE),
          sql`${signalSnapshots.id} IS NULL`,
        ),
      );

    return rows.map((row) => ({
      area: "SIGNAL_CONDITION",
      severity: "ERROR",
      issueCode: "MISSING_CURRENT_SIGNAL",
      blueprintId: row.id,
      userId: row.user_id,
      entityType: "blueprint",
      entityId: row.id,
      expected: "Current signal snapshot for active blueprint",
      actual: "No is_current signal_snapshot",
      repairable: true,
      repairAction: "RECALCULATE_SIGNAL",
    }));
  }

  /** CHECK 3 — active blueprint without current condition. */
  async checkMissingCurrentCondition(): Promise<HealthFinding[]> {
    const rows = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .leftJoin(
        conditions,
        and(eq(conditions.blueprint_id, blueprints.id), eq(conditions.is_current, true)),
      )
      .where(
        and(
          eq(blueprints.active, true),
          eq(blueprints.status, BlueprintStatus.ACTIVE),
          sql`${conditions.id} IS NULL`,
        ),
      );

    return rows.map((row) => ({
      area: "SIGNAL_CONDITION",
      severity: "ERROR",
      issueCode: "MISSING_CURRENT_CONDITION",
      blueprintId: row.id,
      userId: row.user_id,
      entityType: "blueprint",
      entityId: row.id,
      expected: "Current condition for active blueprint",
      actual: "No is_current condition row",
      repairable: true,
      repairAction: "RECALCULATE_SIGNAL",
    }));
  }

  /** CHECK 4 — active blueprint without current enforcement package. */
  async checkMissingCurrentEnforcement(): Promise<HealthFinding[]> {
    const rows = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .leftJoin(
        enforcementPackages,
        and(
          eq(enforcementPackages.blueprint_id, blueprints.id),
          eq(enforcementPackages.is_current, true),
        ),
      )
      .where(
        and(
          eq(blueprints.active, true),
          eq(blueprints.status, BlueprintStatus.ACTIVE),
          sql`${enforcementPackages.id} IS NULL`,
        ),
      );

    return rows.map((row) => ({
      area: "CONTROL",
      severity: "ERROR",
      issueCode: "MISSING_CURRENT_ENFORCEMENT",
      blueprintId: row.id,
      userId: row.user_id,
      entityType: "blueprint",
      entityId: row.id,
      expected: "Current enforcement package for active blueprint",
      actual: "No is_current enforcement package",
      repairable: true,
      repairAction: "REGENERATE_TASK",
    }));
  }

  /** CHECK 5 — orders with missing/invalid blueprint link. */
  async checkTaskWithoutBlueprintLink(): Promise<HealthFinding[]> {
    const rows = await db
      .select({ id: orders.id, user_id: orders.user_id, blueprint_id: orders.blueprint_id })
      .from(orders)
      .leftJoin(blueprints, eq(orders.blueprint_id, blueprints.id))
      .where(
        and(
          inArray(orders.status, [...ACTIVE_ORDER_STATUSES]),
          or(isNull(orders.blueprint_id), isNull(blueprints.id)),
        ),
      )
      .limit(50);

    return rows.map((row) => ({
      area: "TASK_QUEUE",
      severity: "CRITICAL",
      issueCode: "TASK_WITHOUT_BLUEPRINT_LINK",
      blueprintId: row.blueprint_id ?? undefined,
      userId: row.user_id,
      entityType: "order",
      entityId: row.id,
      expected: "Order linked to valid blueprint_id",
      actual: row.blueprint_id ? "Blueprint row missing" : "blueprint_id is null",
      repairable: false,
      repairAction: "ADMIN_REVIEW",
    }));
  }

  /** CHECK 6 — accepted feedback without downstream signal activity. */
  async checkFeedbackWithoutSignalEvent(): Promise<HealthFinding[]> {
    const lookback = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFeedback = await db
      .select({
        id: feedback.id,
        blueprint_id: feedback.blueprint_id,
        user_id: feedback.user_id,
        created_at: feedback.created_at,
      })
      .from(feedback)
      .where(and(gt(feedback.created_at, lookback), eq(feedback.validity, "valid")))
      .limit(30);

    const findings: HealthFinding[] = [];
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

      const [signalEvent] = await db
        .select({ id: events.id })
        .from(events)
        .where(
          and(
            eq(events.blueprint_id, fb.blueprint_id),
            eq(events.event_type, "signal_recalculation_requested"),
            gt(events.created_at, fb.created_at),
          ),
        )
        .limit(1);

      if (!signal && !signalEvent) {
        findings.push({
          area: "SIGNAL_CHAIN",
          severity: "WARN",
          issueCode: "FEEDBACK_WITHOUT_SIGNAL_EVENT",
          blueprintId: fb.blueprint_id,
          userId: fb.user_id,
          entityType: "feedback",
          entityId: fb.id,
          expected: "Signal recalculation after accepted feedback",
          actual: "No signal snapshot or signal_recalculation_requested event",
          repairable: true,
          repairAction: "RECALCULATE_SIGNAL",
        });
      }
    }
    return findings;
  }

  /** CHECK 7 — more than one active order per blueprint. */
  async checkDoubleActiveOrder(): Promise<HealthFinding[]> {
    const dupes = await db
      .select({
        blueprintId: orders.blueprint_id,
        userId: orders.user_id,
        cnt: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(eq(orders.status, OrderStatus.ACTIVE))
      .groupBy(orders.blueprint_id, orders.user_id)
      .having(sql`count(*) > 1`);

    return dupes.map((row) => ({
      area: "TASK_QUEUE",
      severity: "CRITICAL",
      issueCode: "DOUBLE_ACTIVE_ORDER",
      blueprintId: row.blueprintId,
      userId: row.userId,
      entityType: "blueprint",
      entityId: row.blueprintId,
      expected: "At most one active order per blueprint",
      actual: `${row.cnt} active orders`,
      repairable: true,
      repairAction: "REGENERATE_TASK",
    }));
  }

  /** CHECK 8 — state_version stale despite recent user activity. */
  async checkStaleStateVersion(): Promise<HealthFinding[]> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const findings: HealthFinding[] = [];

    const candidates = await db
      .select({
        id: blueprints.id,
        user_id: blueprints.user_id,
        state_version: blueprints.state_version,
        updated_at: blueprints.updated_at,
      })
      .from(blueprints)
      .where(
        and(
          eq(blueprints.active, true),
          eq(blueprints.status, BlueprintStatus.ACTIVE),
          lt(blueprints.updated_at, dayAgo),
        ),
      )
      .limit(50);

    for (const bp of candidates) {
      const [recentFb] = await db
        .select({ id: feedback.id })
        .from(feedback)
        .where(
          and(
            eq(feedback.blueprint_id, bp.id),
            gt(feedback.created_at, dayAgo),
          ),
        )
        .limit(1);

      if (!recentFb) continue;

      findings.push({
        area: "STATE_VERSION",
        severity: "WARN",
        issueCode: "STALE_STATE_VERSION",
        blueprintId: bp.id,
        userId: bp.user_id,
        entityType: "blueprint",
        entityId: bp.id,
        expected: "state_version advances when user submits feedback",
        actual: `state_version=${bp.state_version} unchanged >24h with recent feedback`,
        repairable: true,
        repairAction: "RECALCULATE_SIGNAL",
      });
    }

    return findings;
  }
}

export async function runStateIntegrityEngine(): Promise<StateIntegrityResult> {
  return new StateIntegrityEngine().runAllChecks();
}
