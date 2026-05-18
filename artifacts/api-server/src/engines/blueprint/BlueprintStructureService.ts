import {
  db,
  blueprints,
  plans,
  phases,
  projects,
  actions,
  orders,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { TorgimaError } from "../../lib/errors.js";
import { updateWorldModel } from "../world-model/WorldModelEngine.js";

export interface BlueprintStructure {
  blueprint: typeof blueprints.$inferSelect;
  plans: Array<
    typeof plans.$inferSelect & {
      phases: Array<
        typeof phases.$inferSelect & {
          projects: Array<
            typeof projects.$inferSelect & {
              actions: Array<typeof actions.$inferSelect & { orders: typeof orders.$inferSelect[] }>;
            }
          >;
        }
      >;
    }
  >;
}

export interface DependencyValidationResult {
  valid: boolean;
  violations: string[];
}

export interface PhaseReadinessAssessment {
  ready: boolean;
  missingRequirements: string[];
}

export interface BlueprintMutationResult {
  applied: boolean;
  changes: string[];
  newWorldStateVersion: number;
}

export async function getBlueprintStructure(blueprintId: string): Promise<BlueprintStructure> {
  const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
  if (!bp) throw new TorgimaError("NOT_FOUND", "Blueprint not found");

  const planRows = await db.select().from(plans).where(eq(plans.blueprint_id, blueprintId));
  const planIds = planRows.map(p => p.id);
  const phaseRows = await db.select().from(phases).where(eq(phases.blueprint_id, blueprintId));
  const phaseIds = phaseRows.map(p => p.id);
  const projectRows =
    phaseIds.length > 0
      ? await db.select().from(projects).where(inArray(projects.phase_id, phaseIds))
      : [];
  const projectIds = projectRows.map(p => p.id);
  const actionRows =
    projectIds.length > 0
      ? await db.select().from(actions).where(inArray(actions.project_id, projectIds))
      : [];
  const actionIds = actionRows.map(a => a.id);
  const orderRows =
    actionIds.length > 0
      ? await db.select().from(orders).where(inArray(orders.action_id, actionIds))
      : [];

  const nested = planRows.map(plan => ({
    ...plan,
    phases: phaseRows
      .filter(ph => ph.plan_id === plan.id)
      .map(phase => ({
        ...phase,
        projects: projectRows
          .filter(pr => pr.phase_id === phase.id)
          .map(project => ({
            ...project,
            actions: actionRows
              .filter(a => a.project_id === project.id)
              .map(action => ({
                ...action,
                orders: orderRows.filter(o => o.action_id === action.id),
              })),
          })),
      })),
  }));

  return { blueprint: bp, plans: nested };
}

export async function validateDependencyChain(blueprintId: string): Promise<DependencyValidationResult> {
  const violations: string[] = [];
  const planRows = await db.select().from(plans).where(eq(plans.blueprint_id, blueprintId));
  const phaseRows = await db
    .select()
    .from(phases)
    .innerJoin(plans, eq(phases.plan_id, plans.id))
    .where(eq(plans.blueprint_id, blueprintId));
  const projectRows = await db.select().from(projects).where(eq(projects.blueprint_id, blueprintId));
  const actionRows = await db
    .select({ action: actions, project: projects })
    .from(actions)
    .leftJoin(projects, eq(actions.project_id, projects.id))
    .where(eq(projects.blueprint_id, blueprintId));

  for (const ph of phaseRows) {
    if (!ph.phases.plan_id) {
      violations.push(`Phase ${ph.phases.id} has no parent Plan`);
    }
  }

  for (const pr of projectRows) {
    if (!pr.phase_id) {
      violations.push(`Orphaned Project ${pr.id} — no parent Phase`);
    }
  }

  for (const row of actionRows) {
    if (!row.project?.id) {
      violations.push(`Orphaned Action ${row.action.id} — no parent Project`);
    }
  }

  const orphanOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.blueprint_id, blueprintId), isNull(orders.action_id)));
  for (const o of orphanOrders) {
    violations.push(`Orphaned Order ${o.id} — no parent Action`);
  }

  if (planRows.length === 0) {
    violations.push("Blueprint has no Plans");
  }

  return { valid: violations.length === 0, violations };
}

export async function getPhaseReadiness(phaseId: string): Promise<PhaseReadinessAssessment> {
  const [phase] = await db.select().from(phases).where(eq(phases.id, phaseId)).limit(1);
  if (!phase) return { ready: false, missingRequirements: ["Phase not found"] };

  const gates = (phase.gate_criteria ?? {}) as Record<string, unknown>;
  const missing: string[] = [];
  if (gates["minActionsComplete"]) {
    const required = Number(gates["minActionsComplete"]);
    const completed = await db
      .select({ id: actions.id })
      .from(actions)
      .innerJoin(projects, eq(actions.project_id, projects.id))
        .where(and(eq(projects.phase_id, phaseId), eq(actions.status, "complete")));
    if (completed.length < required) {
      missing.push(`Need ${required} completed actions, have ${completed.length}`);
    }
  }
  return { ready: missing.length === 0, missingRequirements: missing };
}

export async function markPhaseComplete(
  phaseId: string,
  approvedBy: "SYSTEM" | "USER",
): Promise<void> {
  const readiness = await getPhaseReadiness(phaseId);
  if (!readiness.ready) {
    throw new TorgimaError("VALIDATION_ERROR", `Phase not ready: ${readiness.missingRequirements.join(", ")}`);
  }

  const [phase] = await db.select().from(phases).where(eq(phases.id, phaseId)).limit(1);
  if (!phase) throw new TorgimaError("NOT_FOUND", "Phase not found");

  await db
    .update(phases)
    .set({ status: "complete", completed_at: new Date() })
    .where(eq(phases.id, phaseId));

  const siblings = await db
    .select()
    .from(phases)
    .where(and(eq(phases.plan_id, phase.plan_id!), eq(phases.status, "pending")))
    .orderBy(phases.order_index)
    .limit(1);

  if (siblings[0]) {
    await db.update(phases).set({ status: "active" }).where(eq(phases.id, siblings[0].id));
  }

  const [plan] = await db.select({ blueprint_id: plans.blueprint_id }).from(plans).where(eq(plans.id, phase.plan_id!)).limit(1);
  if (plan?.blueprint_id) {
    const [bp] = await db
      .select({ state_version: blueprints.state_version, user_id: blueprints.user_id })
      .from(blueprints)
      .where(eq(blueprints.id, plan.blueprint_id))
      .limit(1);
    if (bp) {
      await db
        .update(blueprints)
        .set({ state_version: bp.state_version + 1 })
        .where(eq(blueprints.id, plan.blueprint_id));
      await updateWorldModel(bp.user_id, "SIGNAL_RECALC").catch(() => null);
    }
  }

  void approvedBy;
}

export async function incrementBlueprintWorldStateVersion(blueprintId: string): Promise<number> {
  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  const next = (bp?.state_version ?? 0) + 1;
  await db.update(blueprints).set({ state_version: next }).where(eq(blueprints.id, blueprintId));
  return next;
}
