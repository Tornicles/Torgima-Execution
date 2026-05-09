import { db } from "@workspace/db";
import {
  blueprints,
  plans,
  phases,
  targets,
  projects,
  actions,
  conditions,
  enforcementPackages,
  orders,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";

export type BlueprintRow = typeof blueprints.$inferSelect;
export type PlanRow = typeof plans.$inferSelect;
export type PhaseRow = typeof phases.$inferSelect;
export type TargetRow = typeof targets.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type ActionRow = typeof actions.$inferSelect;
export type ConditionRow = typeof conditions.$inferSelect;
export type EnforcementRow = typeof enforcementPackages.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;

export interface BlueprintWithChain {
  blueprint:   BlueprintRow;
  plans:       PlanRow[];
  phases:      PhaseRow[];
  targets:     TargetRow[];
  projects:    ProjectRow[];
  actions:     ActionRow[];
  condition:   ConditionRow | null;
  enforcement: EnforcementRow | null;
}

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

  // Spec name: `findActiveBlueprint`. Alias kept so spec callers compile.
  findActiveBlueprint(userId: string): Promise<BlueprintRow | null> {
    return BlueprintRepository.findActive(userId);
  },

  // Spec: `findBlueprintWithChain` — loads the blueprint plus every layer of
  // the execution chain (plans → phases → targets → projects → actions) plus
  // the current condition and enforcement package. Used by services that
  // need to render or operate on the full chain in a single round trip.
  async findBlueprintWithChain(
    blueprintId: string,
    userId: string,
  ): Promise<BlueprintWithChain> {
    const blueprint = await BlueprintRepository.findById(blueprintId, userId);

    const [planRows, phaseRows, targetRows, projectRows, actionRows, conditionRow, enforcementRow] =
      await Promise.all([
        db.select().from(plans).where(eq(plans.blueprint_id, blueprintId)).orderBy(plans.order_index),
        db.select().from(phases).where(eq(phases.blueprint_id, blueprintId)).orderBy(phases.order_index),
        db.select().from(targets).where(eq(targets.blueprint_id, blueprintId)).orderBy(targets.order_index),
        db.select().from(projects).where(eq(projects.blueprint_id, blueprintId)).orderBy(projects.order_index),
        db.select().from(actions).where(eq(actions.blueprint_id, blueprintId)).orderBy(actions.order_index),
        BlueprintRepository.getCurrentCondition(blueprintId),
        BlueprintRepository.getCurrentEnforcement(blueprintId),
      ]);

    return {
      blueprint,
      plans:       planRows,
      phases:      phaseRows,
      targets:     targetRows,
      projects:    projectRows,
      actions:     actionRows,
      condition:   conditionRow,
      enforcement: enforcementRow,
    };
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

  async getActiveOrders(blueprintId: string, userId: string): Promise<OrderRow[]> {
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

  // Spec name: `getCurrentActiveOrders`. Alias kept so spec callers compile.
  getCurrentActiveOrders(blueprintId: string, userId: string): Promise<OrderRow[]> {
    return BlueprintRepository.getActiveOrders(blueprintId, userId);
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
