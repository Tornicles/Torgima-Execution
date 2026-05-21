/**
 * GAP G3 — DOC_17 state integrity checks (partial indexes, loop, queue, signal/condition).
 */

import {
  db,
  blueprints,
  conditions,
  enforcementPackages,
  events,
  orders,
  signalSnapshots,
  stateMemory,
} from "@workspace/db";
import { and, eq, inArray, lt, not, or, sql } from "drizzle-orm";
import { BlueprintStatus, EventStatus, OrderStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import type { HealthFinding } from "../../services/SystemHealthService.js";
import { detectStuckEvents } from "../events/StuckEventDetector.js";
import { checkStateVersionIntegrity } from "./StateVersionIntegrity.js";

type IsCurrentTable = {
  label: string;
  table: typeof signalSnapshots | typeof conditions | typeof enforcementPackages | typeof stateMemory;
};

const IS_CURRENT_TABLES: IsCurrentTable[] = [
  { label: "signal", table: signalSnapshots },
  { label: "condition", table: conditions },
  { label: "enforcement_package", table: enforcementPackages },
  { label: "state_memory", table: stateMemory },
];

export class IntegrityChecker {
  async runAllChecks(): Promise<HealthFinding[]> {
    const started = Date.now();
    const findings: HealthFinding[] = [];

    const runners: Array<() => Promise<HealthFinding[]>> = [
      () => this.checkPartialIndexIntegrity(),
      () => this.checkExecutionLoopIntegrity(),
      () => this.checkTaskQueueIntegrity(),
      () => this.checkSignalConditionAlignment(),
      () => this.checkStalledEvents(),
      () => this.checkOrphanedOrders(),
      () => this.checkEventBacklog(),
      () => checkStateVersionIntegrity(),
    ];

    for (const run of runners) {
      try {
        findings.push(...(await run()));
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err), check: run.name },
          "[IntegrityChecker] Check failed",
        );
      }
    }

    logger.info(
      { findings: findings.length, durationMs: Date.now() - started },
      "[IntegrityChecker] runAllChecks complete",
    );

    return findings;
  }

  async checkPartialIndexIntegrity(): Promise<HealthFinding[]> {
    const findings: HealthFinding[] = [];

    for (const { label, table } of IS_CURRENT_TABLES) {
      const duplicates = await db
        .select({
          blueprintId: table.blueprint_id,
          cnt: sql<number>`count(*)::int`,
        })
        .from(table)
        .where(eq(table.is_current, true))
        .groupBy(table.blueprint_id)
        .having(sql`count(*) > 1`);

      for (const row of duplicates) {
        findings.push({
          area: "DATABASE",
          severity: "CRITICAL",
          issueCode: `DUPLICATE_IS_CURRENT_${label.toUpperCase()}`,
          blueprintId: row.blueprintId,
          entityType: "blueprint",
          entityId: row.blueprintId,
          expected: "Exactly one is_current=true row per blueprint",
          actual: `${row.cnt} is_current rows in ${label}`,
          repairable: false,
          repairAction: "ADMIN_REVIEW",
        });
      }
    }

    return findings;
  }

  async checkExecutionLoopIntegrity(): Promise<HealthFinding[]> {
    const missing = await db
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
          eq(blueprints.status, BlueprintStatus.ACTIVE),
          eq(blueprints.active, true),
          sql`${enforcementPackages.id} IS NULL`,
        ),
      );

    return missing.map((row) => ({
      area: "EXECUTION_LOOP",
      severity: "ERROR",
      issueCode: "ACTIVE_BLUEPRINT_NO_ENFORCEMENT",
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

  async checkTaskQueueIntegrity(): Promise<HealthFinding[]> {
    const empty = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .leftJoin(
        orders,
        and(
          eq(orders.blueprint_id, blueprints.id),
          inArray(orders.status, [OrderStatus.PENDING, OrderStatus.ACTIVE]),
        ),
      )
      .where(
        and(
          eq(blueprints.status, BlueprintStatus.ACTIVE),
          eq(blueprints.active, true),
          sql`${orders.id} IS NULL`,
        ),
      );

    return empty.map((row) => ({
      area: "TASK_QUEUE",
      severity: "WARN",
      issueCode: "ACTIVE_BLUEPRINT_NO_ORDER",
      blueprintId: row.id,
      userId: row.user_id,
      entityType: "blueprint",
      entityId: row.id,
      expected: "At least one pending or active order",
      actual: "No pending/active orders",
      repairable: true,
      repairAction: "REGENERATE_TASK",
    }));
  }

  async checkSignalConditionAlignment(): Promise<HealthFinding[]> {
    const misaligned = await db
      .select({
        blueprintId: signalSnapshots.blueprint_id,
        userId: signalSnapshots.user_id,
        snapshotId: signalSnapshots.id,
      })
      .from(signalSnapshots)
      .leftJoin(
        conditions,
        and(
          eq(conditions.blueprint_id, signalSnapshots.blueprint_id),
          eq(conditions.is_current, true),
        ),
      )
      .where(and(eq(signalSnapshots.is_current, true), sql`${conditions.id} IS NULL`));

    return misaligned.map((row) => ({
      area: "SIGNAL_CONDITION",
      severity: "ERROR",
      issueCode: "SIGNAL_WITHOUT_CONDITION",
      blueprintId: row.blueprintId,
      userId: row.userId,
      entityType: "signal_snapshot",
      entityId: row.snapshotId,
      expected: "Current condition when current signal snapshot exists",
      actual: "Signal snapshot without matching is_current condition",
      repairable: true,
      repairAction: "RECALCULATE_SIGNAL",
    }));
  }

  async checkStalledEvents(): Promise<HealthFinding[]> {
    const { requeued, deadLettered } = await detectStuckEvents();
    const findings: HealthFinding[] = [];

    if (requeued > 0) {
      findings.push({
        area: "EVENT_SYSTEM",
        severity: "WARN",
        issueCode: "STUCK_CLAIMED_EVENTS_REQUEUED",
        expected: "No CLAIMED events past processing SLA",
        actual: `${requeued} events re-queued from CLAIMED`,
        repairable: true,
        repairAction: "RETRY_EVENT",
      });
    }

    if (deadLettered > 0) {
      findings.push({
        area: "EVENT_SYSTEM",
        severity: "ERROR",
        issueCode: "STUCK_CLAIMED_EVENTS_DEAD_LETTERED",
        expected: "Workers complete CLAIMED events within SLA",
        actual: `${deadLettered} stuck events moved to dead letter`,
        repairable: false,
        repairAction: "ADMIN_REVIEW",
      });
    }

    return findings;
  }

  async checkOrphanedOrders(): Promise<HealthFinding[]> {
    const orphaned = await db
      .select({
        orderId: orders.id,
        blueprintId: orders.blueprint_id,
        userId: orders.user_id,
        bpStatus: blueprints.status,
        bpActive: blueprints.active,
      })
      .from(orders)
      .innerJoin(blueprints, eq(orders.blueprint_id, blueprints.id))
      .where(
        and(
          inArray(orders.status, [OrderStatus.PENDING, OrderStatus.ACTIVE]),
          or(
            not(eq(blueprints.status, BlueprintStatus.ACTIVE)),
            eq(blueprints.active, false),
          ),
        ),
      )
      .limit(50);

    return orphaned.map((row) => ({
      area: "EXECUTION_LOOP",
      severity: "ERROR",
      issueCode: "ORPHANED_ACTIVE_ORDER",
      blueprintId: row.blueprintId,
      userId: row.userId,
      entityType: "order",
      entityId: row.orderId,
      expected: "Active/pending orders only on active blueprints",
      actual: `Order ${row.orderId} on blueprint status=${row.bpStatus} active=${row.bpActive}`,
      repairable: true,
      repairAction: "REGENERATE_TASK",
    }));
  }

  async checkEventBacklog(): Promise<HealthFinding[]> {
    const threshold = new Date(Date.now() - 5 * 60 * 1000);
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(
        and(
          inArray(events.status, [EventStatus.PENDING, EventStatus.RETRY_PENDING]),
          lt(events.process_after, threshold),
        ),
      );

    const stuckCount = count ?? 0;
    if (stuckCount <= 10) return [];

    return [
      {
        area: "EVENT_SYSTEM",
        severity: stuckCount > 50 ? "CRITICAL" : "WARN",
        issueCode: "EVENT_BACKLOG_HIGH",
        expected: "< 10 pending events older than 5 minutes",
        actual: `${stuckCount} stuck events`,
        repairable: true,
        repairAction: "RETRY_EVENT",
      },
    ];
  }

}

let _checker: IntegrityChecker | null = null;

export function getIntegrityChecker(): IntegrityChecker {
  if (!_checker) _checker = new IntegrityChecker();
  return _checker;
}

export async function runIntegrityCheckerChecks(): Promise<HealthFinding[]> {
  return getIntegrityChecker().runAllChecks();
}
