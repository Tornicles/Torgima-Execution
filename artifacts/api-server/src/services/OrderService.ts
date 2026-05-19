import { logger } from "../lib/logger.js";
import { TorgimaError } from "../lib/errors.js";
import { generateId, now } from "../lib/utils.js";
import type { Order } from "../types/order.js";
import {
  db,
  orders as ordersTable,
  blueprints as blueprintsTable,
  orderKnowledgeLinks,
  knowledgeObjects,
  orderDependencies,
  signalSnapshots,
} from "@workspace/db";
import { and, desc, eq, inArray, count } from "drizzle-orm";
import { computeOrderPriorityDimensions } from "../engines/order/OrderPrioritizationEngine.js";
import { ApiOrderStatus, OrderStatus } from "@workspace/state-machine";

const store = new Map<string, Order>();

function mapDbOrderRow(row: typeof ordersTable.$inferSelect): Order {
  const statusMap: Record<string, Order["status"]> = {
    [OrderStatus.PENDING]:        ApiOrderStatus.QUEUED,
    [OrderStatus.ACTIVE]:         ApiOrderStatus.ACTIVE,
    [OrderStatus.PAUSED]:         ApiOrderStatus.PAUSED,
    [OrderStatus.BLOCKED]:        ApiOrderStatus.BLOCKED,
    [OrderStatus.NEEDS_FEEDBACK]: ApiOrderStatus.IN_PROGRESS,
    [OrderStatus.NEEDS_PROOF]:    ApiOrderStatus.IN_PROGRESS,
    [OrderStatus.COMPLETED]:      ApiOrderStatus.COMPLETE,
    [OrderStatus.FAILED]:         ApiOrderStatus.CANCELLED,
    [OrderStatus.SKIPPED]:        ApiOrderStatus.CANCELLED,
    [OrderStatus.CANCELLED]:      ApiOrderStatus.CANCELLED,
  };
  const taskTypeMap: Partial<Record<string, Order["type"]>> = {
    execution: "action",
    recovery: "action",
    academy: "review",
    clarification: "action",
    blocker_resolution: "action",
    phase_checkpoint: "checkpoint",
    habit: "habit",
    review: "review",
  };
  const typeFallback: Order["type"] = "action";

  return {
    id:               row.id,
    blueprintId:      row.blueprint_id,
    userId:           row.user_id,
    title:            row.title,
    description:      row.instruction,
    type:             taskTypeMap[row.task_type] ?? typeFallback,
    status:           statusMap[row.status] ?? ApiOrderStatus.ACTIVE,
    priority:         row.priority,
    estimatedMinutes: row.time_estimate_minutes,
    instructions:     row.instruction,
    proofRequired:    row.proof_required,
    blockedReason:    row.blocker_description,
    startedAt:        row.started_at?.toISOString() ?? null,
    completedAt:      row.finished_at?.toISOString() ?? null,
    createdAt:        row.created_at.toISOString(),
  };
}

/** Matches GET /api/orders/active projection — Prompt 15 dashboard `currentAction`. */
export interface DashboardPrimaryTask {
  /** Same as {@link DashboardPrimaryTask.orderId} — parity with REST order payloads. */
  id: string;
  orderId: string;
  blueprintId: string;
  stateVersion: number;
  title: string;
  instruction: string;
  expectedOutput: string;
  definitionOfDone: string;
  whyItMatters: string | null;
  difficulty: string;
  taskType: string;
  timeEstimateMinutes: number | null;
  proofRequired: boolean;
  proofType: string | null;
  proofDescription: string | null;
  status: string;
  domain: string | null;
  priority: number;
  /** Deterministic composite prioritization (dashboard primary selection). */
  priorityEngine?: {
    priorityScore: number;
    breakdown: {
      urgencyScore: number;
      leverageScore: number;
      dependencyRiskScore: number;
      timingSensitivityScore: number;
      strategicWeight: number;
    };
    formulaSummary: string;
  };
  knowledgeObjects: Array<{
    id: string;
    title: string | null;
    content: string | null;
    type: string | null;
  }>;
}

export const OrderService = {
  /** Highest-priority pending/active order for user's active blueprint, with knowledge links (max 3). */
  async getPrimaryDashboardTask(userId: string): Promise<DashboardPrimaryTask | null> {
    const [bp] = await db
      .select({
        id: blueprintsTable.id,
        state_version: blueprintsTable.state_version,
      })
      .from(blueprintsTable)
      .where(and(eq(blueprintsTable.user_id, userId), eq(blueprintsTable.active, true)))
      .limit(1);

    if (!bp) return null;

    const candidates = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.blueprint_id, bp.id),
          eq(ordersTable.user_id, userId),
          inArray(ordersTable.status, [OrderStatus.PENDING, OrderStatus.ACTIVE]),
        ),
      )
      .limit(40);

    if (candidates.length === 0) return null;

    const [sigRow] = await db
      .select({ assigned_condition: signalSnapshots.assigned_condition })
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, bp.id), eq(signalSnapshots.is_current, true)))
      .limit(1);

    const ids = candidates.map((o) => o.id);
    const blockerRows = await db
      .select({
        blockingId: orderDependencies.blocking_order_id,
        downstream: count(orderDependencies.blocked_order_id),
      })
      .from(orderDependencies)
      .where(and(eq(orderDependencies.blueprint_id, bp.id), inArray(orderDependencies.blocking_order_id, ids)))
      .groupBy(orderDependencies.blocking_order_id);

    const impact = new Map<string, number>();
    for (const row of blockerRows) {
      impact.set(row.blockingId, Number(row.downstream));
    }

    let bestOrder = candidates[0]!;
    let bestDiag = computeOrderPriorityDimensions(bestOrder, {
      downstreamBlockedCount: impact.get(bestOrder.id) ?? 0,
      blueprintCondition: sigRow?.assigned_condition,
    });
    let bestPri = bestDiag.priorityScore;
    for (let i = 1; i < candidates.length; i++) {
      const o = candidates[i]!;
      const d = computeOrderPriorityDimensions(o, {
        downstreamBlockedCount: impact.get(o.id) ?? 0,
        blueprintCondition: sigRow?.assigned_condition,
      });
      if (d.priorityScore > bestPri) {
        bestPri = d.priorityScore;
        bestOrder = o;
        bestDiag = d;
      }
    }

    const order = bestOrder;

    const linkRows = await db
      .select({
        kid: knowledgeObjects.id,
        title: knowledgeObjects.title,
        content: knowledgeObjects.content,
        type: knowledgeObjects.type,
      })
      .from(orderKnowledgeLinks)
      .innerJoin(knowledgeObjects, eq(orderKnowledgeLinks.knowledge_id, knowledgeObjects.id))
      .where(eq(orderKnowledgeLinks.order_id, order.id))
      .limit(3);

    return {
      id: order.id,
      orderId: order.id,
      blueprintId: bp.id,
      stateVersion: bp.state_version ?? 0,
      title: order.title,
      instruction: order.instruction,
      expectedOutput: order.expected_output,
      definitionOfDone: order.definition_of_done,
      whyItMatters: order.why_it_matters,
      difficulty: order.difficulty,
      taskType: order.task_type,
      timeEstimateMinutes: order.time_estimate_minutes,
      proofRequired: order.proof_required,
      proofType: order.proof_type,
      proofDescription: order.proof_description,
      status: order.status,
      domain: order.domain,
      priority: order.priority,
      priorityEngine: {
        priorityScore: bestDiag.priorityScore,
        breakdown: {
          urgencyScore: bestDiag.urgencyScore,
          leverageScore: bestDiag.leverageScore,
          dependencyRiskScore: bestDiag.dependencyRiskScore,
          timingSensitivityScore: bestDiag.timingSensitivityScore,
          strategicWeight: bestDiag.strategicWeight,
        },
        formulaSummary: bestDiag.formulaSummary,
      },
      knowledgeObjects: linkRows.map((k) => ({
        id: k.kid,
        title: k.title,
        content: k.content,
        type: k.type,
      })),
    };
  },

  async getActive(userId: string): Promise<Order[]> {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.user_id, userId),
          inArray(ordersTable.status, [OrderStatus.PENDING, OrderStatus.ACTIVE]),
        ),
      )
      .orderBy(desc(ordersTable.priority), desc(ordersTable.created_at));
    return rows.map(mapDbOrderRow);
  },

  async get(id: string, userId: string): Promise<Order> {
    try {
      const [row] = await db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.id, id), eq(ordersTable.user_id, userId)))
        .limit(1);
      if (row) return mapDbOrderRow(row);
    } catch {
      /* fall through to in-memory */
    }

    const o = store.get(id);
    if (!o) throw new TorgimaError("NOT_FOUND", "Order not found");
    if (o.userId !== userId) throw new TorgimaError("FORBIDDEN", "Access denied");
    return o;
  },

  async start(id: string, userId: string): Promise<Order> {
    const o = await OrderService.get(id, userId);
    const updated: Order = { ...o, status: ApiOrderStatus.IN_PROGRESS, startedAt: now() };
    store.set(id, updated);
    return updated;
  },

  async finish(id: string, userId: string): Promise<Order> {
    const o = await OrderService.get(id, userId);
    const updated: Order = { ...o, status: ApiOrderStatus.COMPLETE, completedAt: now() };
    store.set(id, updated);
    return updated;
  },

  async block(id: string, userId: string, reason: string): Promise<Order> {
    const o = await OrderService.get(id, userId);
    const updated: Order = { ...o, status: ApiOrderStatus.BLOCKED, blockedReason: reason };
    store.set(id, updated);
    return updated;
  },

  async pause(id: string, userId: string): Promise<Order> {
    const o = await OrderService.get(id, userId);
    const updated: Order = { ...o, status: ApiOrderStatus.PAUSED };
    store.set(id, updated);
    return updated;
  },

  async resume(id: string, userId: string): Promise<Order> {
    const o = await OrderService.get(id, userId);
    const updated: Order = { ...o, status: ApiOrderStatus.ACTIVE };
    store.set(id, updated);
    return updated;
  },

  seed(blueprintId: string, userId: string): void {
    logger.info({ blueprintId, userId }, "OrderService.seed (in-memory dev tasks)");
    const tasks: Order[] = [
      {
        id: generateId(),
        blueprintId,
        userId,
        title: "Define your north star metric",
        description: "Identify the single metric that, if moved, would indicate real progress",
        type: "action",
        status: ApiOrderStatus.ACTIVE,
        priority: 1,
        estimatedMinutes: 45,
        instructions: "Write it down. Make it measurable. Set a target and a deadline.",
        proofRequired: false,
        blockedReason: null,
        startedAt: null,
        completedAt: null,
        createdAt: now(),
      },
    ];
    tasks.forEach((t) => store.set(t.id, t));
  },
};
