/**
 * Prompt 7B — Record execution structure (plans → phases → projects → actions) into sequence tables.
 */
import { db, actions, executionStructureSequences, miniPlanSequences, phases, plans, projects } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEFAULT_PLAN_NAMES } from "../blueprint/BlueprintRuleEngine.js";
import { SequenceTrackingService } from "../../services/SequenceTrackingService.js";
import { DEFAULT_STARTER_ALLOCATION } from "../mini-plan/MiniPlanAllocationEngine.js";

export async function recordExecutionStructureFromBlueprint(blueprintId: string, tier?: string | null) {
  const planRows = await db.select().from(plans).where(eq(plans.blueprint_id, blueprintId));
  const phaseRows = await db.select().from(phases).where(eq(phases.blueprint_id, blueprintId));
  const projectRows = await db.select().from(projects).where(eq(projects.blueprint_id, blueprintId));
  const actionRows = await db.select().from(actions).where(eq(actions.blueprint_id, blueprintId));

  const miniPlanNames =
    planRows.length > 0 ? planRows.map((p) => p.name) : [...DEFAULT_PLAN_NAMES];

  await db
    .insert(miniPlanSequences)
    .values({
      blueprint_id: blueprintId,
      mini_plans: miniPlanNames,
      cross_plan_prep: {
        ...DEFAULT_STARTER_ALLOCATION,
        ...Object.fromEntries(
          miniPlanNames.map((n) => {
            const key = n === "Validation" ? "Operations" : n === "Scale" ? "Growth" : n;
            const alloc =
              DEFAULT_STARTER_ALLOCATION[key as keyof typeof DEFAULT_STARTER_ALLOCATION] ?? 33;
            return [n, alloc];
          }),
        ),
      },
      dependency_aware: { planIds: planRows.map((p) => p.id) },
    })
    .onConflictDoUpdate({
      target: miniPlanSequences.blueprint_id,
      set: {
        mini_plans: miniPlanNames,
        dependency_aware: { planIds: planRows.map((p) => p.id), phaseIds: phaseRows.map((p) => p.id) },
      },
    });

  await db
    .insert(executionStructureSequences)
    .values({
      blueprint_id: blueprintId,
      phases: phaseRows.map((p) => p.name),
      action_types: [...new Set(actionRows.map((a) => a.type ?? a.action_type ?? "create"))],
      targets: {
        major: planRows[0]?.outcome ?? planRows[0]?.name,
        primary: planRows[1]?.name,
        vital: phaseRows.find((p) => p.is_active)?.name ?? phaseRows[0]?.name,
      },
      project_structure: {
        planCount: planRows.length,
        phaseCount: phaseRows.length,
        projectCount: projectRows.length,
        actionCount: actionRows.length,
        plans: planRows.map((p) => ({ id: p.id, name: p.name })),
        phases: phaseRows.map((p) => ({ id: p.id, name: p.name, planId: p.plan_id })),
        projects: projectRows.map((p) => ({ id: p.id, name: p.name, phaseId: p.phase_id })),
        actions: actionRows.map((a) => ({ id: a.id, name: a.name, projectId: a.project_id })),
      },
    })
    .onConflictDoUpdate({
      target: executionStructureSequences.blueprint_id,
      set: {
        phases: phaseRows.map((p) => p.name),
        project_structure: {
          planCount: planRows.length,
          phaseCount: phaseRows.length,
          projectCount: projectRows.length,
          actionCount: actionRows.length,
        },
      },
    });

  await SequenceTrackingService.ensureInitialized(blueprintId, tier);

  return {
    planCount: planRows.length,
    phaseCount: phaseRows.length,
    projectCount: projectRows.length,
    actionCount: actionRows.length,
  };
}
