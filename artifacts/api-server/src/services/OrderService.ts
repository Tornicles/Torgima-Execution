import { logger } from "../lib/logger.js";
import { TorgimaError } from "../lib/errors.js";
import { generateId, now } from "../lib/utils.js";
import type { Order } from "../types/order.js";

// In-memory store for Prompt 1 scaffold — replaced by OrderRepository in Prompt 3
const store = new Map<string, Order>();

export const OrderService = {
  async getActive(userId: string): Promise<Order[]> {
    return Array.from(store.values()).filter(
      (o) => o.userId === userId && ["queued", "active", "in_progress", "paused"].includes(o.status),
    );
  },

  async get(id: string, userId: string): Promise<Order> {
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
      {
        id: generateId(),
        blueprintId,
        userId,
        title: "Map your current reality",
        description: "Document where you are today, honestly",
        type: "research",
        status: "queued",
        priority: 2,
        estimatedMinutes: 30,
        instructions: "No filters. Current state only. What's true right now?",
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
