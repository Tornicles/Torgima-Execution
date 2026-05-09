import { db } from "@workspace/db";
import {
  blueprints,
  plans,
  phases,
  targets,
  conditions,
  enforcementPackages,
  orders,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";

export type BlueprintRow = typeof blueprints.$inferSelect;
export type PlanRow = typeof plans.$inferSelect;
export type PhaseRow = typeof phases.$inferSelect;
export type ConditionRow = typeof conditions.$inferSelect;
export type EnforcementRow = typeof enforcementPackages.$inferSelect;

export const BlueprintRepository = {
  async findById(id: string, userId: string): Promise<BlueprintRow> {
    const rows = await db
      .select()
      .from(blueprints)
      .where(and(eq(blueprints.id, id), eq(blueprints.user_id, userId)))
      .limit(1);
    const row = rows[0] ?? null;
    if (!row) throw new TorgimaError("NOT_FOUND", "Blueprint not found");
    return row;
  },

  async findByIdUnchecked(id: string): Promise<BlueprintRow | null> {
    const rows = await db.select().from(blueprints).where(eq(blueprints.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findActive(userId: string): Promise<BlueprintRow | null> {
    const rows = await db
      .select()
      .from(blueprints)
      .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
      .orderBy(desc(blueprints.created_at))
      .limit(1);
    return rows[0] ?? null;
  },

  async listForUser(userId: string): Promise<BlueprintRow[]> {
    return db
      .select()
      .from(blueprints)
      .where(eq(blueprints.user_id, userId))
      .orderBy(desc(blueprints.created_at));
  },

  async listHistoryForUser(userId: string): Promise<BlueprintRow[]> {
    const rows = await db
      .select()
      .from(blueprints)
      .where(eq(blueprints.user_id, userId))
      .orderBy(desc(blueprints.created_at));
    return rows.filter((r) => r.status === "complete" || r.status === "abandoned");
  },

  async getCurrentCondition(blueprintId: string): Promise<ConditionRow | null> {
    const rows = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
      .orderBy(desc(conditions.entered_at))
      .limit(1);
    return rows[0] ?? null;
  },

  async getCurrentEnforcement(blueprintId: string): Promise<EnforcementRow | null> {
    const rows = await db
      .select()
      .from(enforcementPackages)
      .where(
        and(
          eq(enforcementPackages.blueprint_id, blueprintId),
          eq(enforcementPackages.is_current, true),
        ),
      )
      .orderBy(desc(enforcementPackages.created_at))
      .limit(1);
    return rows[0] ?? null;
  },

  async getActiveOrders(blueprintId: string, userId: string): Promise<(typeof orders.$inferSelect)[]> {
    return db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          eq(orders.user_id, userId),
          eq(orders.status, "active"),
        ),
      )
      .orderBy(desc(orders.created_at));
  },

  async getPhases(blueprintId: string): Promise<PhaseRow[]> {
    return db
      .select()
      .from(phases)
      .where(eq(phases.blueprint_id, blueprintId))
      .orderBy(phases.order_index);
  },

  async getCurrentPhase(blueprintId: string): Promise<PhaseRow | null> {
    const rows = await db
      .select()
      .from(phases)
      .where(
        and(
          eq(phases.blueprint_id, blueprintId),
          eq(phases.status, "active"),
        ),
      )
      .orderBy(phases.order_index)
      .limit(1);
    return rows[0] ?? null;
  },

  async getPlans(blueprintId: string): Promise<PlanRow[]> {
    return db
      .select()
      .from(plans)
      .where(eq(plans.blueprint_id, blueprintId))
      .orderBy(plans.order_index);
  },
};
