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
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";

const store = new Map<string, Order>();

function mapDbOrderRow(row: typeof ordersTable.$inferSelect): Order {
  const statusMap: Record<string, Order["status"]> = {
    pending:        "queued",
    active:         "active",
    paused:         "paused",
    blocked:        "blocked",
    needs_feedback: "in_progress",
    needs_proof:    "in_progress",
    completed:      "complete",
    failed:         "cancelled",
    skipped:        "cancelled",
    cancelled:      "cancelled",
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
    status:           statusMap[row.status] ?? "active",
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

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.blueprint_id, bp.id),
          eq(ordersTable.user_id, userId),
          inArray(ordersTable.status, ["pending", "active"]),
        ),
      )
      .orderBy(desc(ordersTable.priority))
      .limit(1);

    if (!order) return null;

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
          inArray(ordersTable.status, ["pending", "active"]),
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
    const updated: Order = { ...o, status: "in_progress", startedAt: now() };
    store.set(id, updated);
    return updated;
  },

  async finish(id: string, userId: string): Promise<Order> {
    const o = await OrderService.get(id, userId);
    const updated: Order = { ...o, status: "complete", completedAt: now() };
    store.set(id, updated);
    return updated;
  },

  async block(id: string, userId: string, reason: string): Promise<Order> {
    const o = await OrderService.get(id, userId);
    const updated: Order = { ...o, status: "blocked", blockedReason: reason };
    store.set(id, updated);
    return updated;
  },

  async pause(id: string, userId: string): Promise<Order> {
    const o = await OrderService.get(id, userId);
    const updated: Order = { ...o, status: "paused" };
    store.set(id, updated);
    return updated;
  },

  async resume(id: string, userId: string): Promise<Order> {
    const o = await OrderService.get(id, userId);
    const updated: Order = { ...o, status: "active" };
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
        status: "active",
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
