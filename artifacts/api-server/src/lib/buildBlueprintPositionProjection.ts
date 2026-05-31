import {
  db,
  actions,
  blueprints,
  phases,
  plans,
  projects,
  targets,
} from "@workspace/db";
import { and, count, eq, sql } from "drizzle-orm";

export type BlueprintPositionProjection = {
  tier: string;
  currentPlan: {
    id: string;
    name: string;
    planType: string | null;
    sequenceNumber: number;
    status: string;
  } | null;
  currentTarget: {
    id: string;
    name: string;
    metric: string | null;
    expectedValue: string | null;
    status: string;
  } | null;
  currentPhase: {
    id: string;
    name: string;
    phaseType: string | null;
    status: string;
  } | null;
  currentProject: {
    id: string;
    name: string;
    projectType: string | null;
    status: string;
  } | null;
  currentAction: {
    id: string;
    name: string;
    instruction: string | null;
    expectedOutput: string | null;
    actionType: string | null;
  } | null;
  progressSummary: {
    plansTotal: number;
    plansCompleted: number;
    phasesTotal: number;
    phasesCompleted: number;
    actionsTotal: number;
    actionsCompleted: number;
    percentComplete: number;
  };
};

export async function buildBlueprintPositionProjection(
  blueprintId: string,
  userId: string,
): Promise<BlueprintPositionProjection | null> {
  const [bp] = await db
    .select({
      tier: blueprints.tier,
      current_plan_id: blueprints.current_plan_id,
      current_phase_id: blueprints.current_phase_id,
      current_project_id: blueprints.current_project_id,
      current_action_id: blueprints.current_action_id,
    })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!bp) return null;

  const tier = bp.tier ?? "starter";

  const [currentPlan] = bp.current_plan_id
    ? await db
        .select({
          id: plans.id,
          name: plans.name,
          order_index: plans.order_index,
          status: plans.status,
        })
        .from(plans)
        .where(eq(plans.id, bp.current_plan_id))
        .limit(1)
    : [];

  const [currentPhase] = bp.current_phase_id
    ? await db
        .select({
          id: phases.id,
          name: phases.name,
          status: phases.status,
          target_id: phases.target_id,
        })
        .from(phases)
        .where(eq(phases.id, bp.current_phase_id))
        .limit(1)
    : [];

  const [currentProject] = bp.current_project_id
    ? await db
        .select({
          id: projects.id,
          name: projects.name,
          type: projects.type,
          status: projects.status,
        })
        .from(projects)
        .where(eq(projects.id, bp.current_project_id))
        .limit(1)
    : [];

  const [currentAction] = bp.current_action_id
    ? await db
        .select({
          id: actions.id,
          name: actions.name,
          description: actions.description,
          expected_output: actions.expected_output,
          action_type: actions.action_type,
          type: actions.type,
        })
        .from(actions)
        .where(eq(actions.id, bp.current_action_id))
        .limit(1)
    : [];

  const [currentTarget] =
    currentPhase?.target_id
      ? await db
          .select({
            id: targets.id,
            name: targets.name,
            metric: targets.metric,
            target_value: targets.target_value,
            status: targets.status,
          })
          .from(targets)
          .where(eq(targets.id, currentPhase.target_id))
          .limit(1)
      : [];

  const [[planStats], [phaseStats], [actionStats]] = await Promise.all([
    db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${plans.status} = 'complete')`,
      })
      .from(plans)
      .where(eq(plans.blueprint_id, blueprintId)),
    db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${phases.status} = 'complete')`,
      })
      .from(phases)
      .where(eq(phases.blueprint_id, blueprintId)),
    db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${actions.status} = 'complete')`,
      })
      .from(actions)
      .where(eq(actions.blueprint_id, blueprintId)),
  ]);

  const plansTotal = Number(planStats?.total ?? 0);
  const phasesTotal = Number(phaseStats?.total ?? 0);
  const actionsTotal = Number(actionStats?.total ?? 0);
  const plansCompleted = Number(planStats?.completed ?? 0);
  const phasesCompleted = Number(phaseStats?.completed ?? 0);
  const actionsCompleted = Number(actionStats?.completed ?? 0);

  const denom = plansTotal + phasesTotal + actionsTotal;
  const numer = plansCompleted + phasesCompleted + actionsCompleted;
  const percentComplete = denom > 0 ? Math.round((numer / denom) * 100) : 0;

  return {
    tier,
    currentPlan: currentPlan
      ? {
          id: currentPlan.id,
          name: currentPlan.name,
          planType: null,
          sequenceNumber: currentPlan.order_index,
          status: currentPlan.status,
        }
      : null,
    currentTarget: currentTarget
      ? {
          id: currentTarget.id,
          name: currentTarget.name,
          metric: currentTarget.metric ?? null,
          expectedValue:
            currentTarget.target_value != null ? String(currentTarget.target_value) : null,
          status: currentTarget.status,
        }
      : null,
    currentPhase: currentPhase
      ? {
          id: currentPhase.id,
          name: currentPhase.name,
          phaseType: String(currentPhase.name) ?? null,
          status: currentPhase.status,
        }
      : null,
    currentProject: currentProject
      ? {
          id: currentProject.id,
          name: currentProject.name,
          projectType: currentProject.type ?? null,
          status: currentProject.status,
        }
      : null,
    currentAction: currentAction
      ? {
          id: currentAction.id,
          name: currentAction.name ?? currentAction.id,
          instruction: currentAction.description ?? null,
          expectedOutput: currentAction.expected_output ?? null,
          actionType: currentAction.action_type ?? currentAction.type ?? null,
        }
      : null,
    progressSummary: {
      plansTotal,
      plansCompleted,
      phasesTotal,
      phasesCompleted,
      actionsTotal,
      actionsCompleted,
      percentComplete,
    },
  };
}
