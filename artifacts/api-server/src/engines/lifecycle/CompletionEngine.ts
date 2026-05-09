import {
  db,
  blueprints,
  plans,
  feedback,
  falseProgressFlags,
  pivotReviews,
  phases,
  orders,
  stateMemory,
  milestones,
  capabilityProfiles,
  userIdentityStates,
  inactivityRecords,
} from "@workspace/db";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEventInTx, EVENT_TYPES } from "../../services/EventService.js";
import { evaluateIdentity } from "../identity/IdentityEngine.js";
import { deactivateBlueprintBhudhiMemory } from "../../bhudhi/MemoryService.js";
import { notifyBlueprintCompleted, notifyMilestoneAchieved } from "../../services/notification/LifecycleNotificationWiring.js";

export interface CompletionCheckResult {
  eligible: boolean;
  passedChecks: string[];
  failedChecks: string[];
  blockers: string[];
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function checkCompletionEligibility(params: {
  blueprintId: string;
  userId: string;
}): Promise<CompletionCheckResult> {
  const passed: string[] = [];
  const failed: string[] = [];
  const blockers: string[] = [];

  const [blueprint] = await db
    .select()
    .from(blueprints)
    .where(
      and(
        eq(blueprints.id, params.blueprintId),
        eq(blueprints.user_id, params.userId),
        eq(blueprints.active, true),
      ),
    )
    .limit(1);

  if (!blueprint) {
    return {
      eligible: false,
      passedChecks: [],
      failedChecks: ["blueprint_not_found"],
      blockers: ["No active blueprint found"],
    };
  }

  if (blueprint.status === "active") passed.push("blueprint_active");
  else {
    failed.push("blueprint_active");
    blockers.push("Blueprint must be active to complete");
  }

  const [planAgg] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(plans)
    .where(eq(plans.blueprint_id, params.blueprintId));

  const planCount = planAgg?.c ?? 0;
  if (planCount > 0) passed.push("has_plans");
  else {
    failed.push("has_plans");
    blockers.push("No execution plans found");
  }

  const [{ fc }] = await db
    .select({ fc: sql<number>`count(*)::int` })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, params.blueprintId), eq(feedback.validity, "valid")));

  const feedbackCount = fc ?? 0;
  if (feedbackCount > 0) passed.push("has_execution");
  else {
    failed.push("has_execution");
    blockers.push("No verified execution found — at least one completed task is required");
  }

  const [{ openFlagCount }] = await db
    .select({ openFlagCount: sql<number>`count(*)::int` })
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, params.blueprintId),
        eq(falseProgressFlags.resolved, false),
      ),
    );

  if ((openFlagCount ?? 0) === 0) passed.push("no_false_progress");
  else {
    failed.push("no_false_progress");
    blockers.push(`${openFlagCount} open false progress flag(s) must be resolved first`);
  }

  const [openPivotReview] = await db
    .select({ id: pivotReviews.id })
    .from(pivotReviews)
    .where(and(eq(pivotReviews.blueprint_id, params.blueprintId), eq(pivotReviews.status, "open")))
    .limit(1);

  if (!openPivotReview) passed.push("no_open_pivot_review");
  else {
    failed.push("no_open_pivot_review");
    blockers.push("Open pivot review must be resolved before completion");
  }

  const [{ completedPhases }] = await db
    .select({ completedPhases: sql<number>`count(*)::int` })
    .from(phases)
    .where(and(eq(phases.blueprint_id, params.blueprintId), eq(phases.status, "complete")));

  const [{ totalPhases }] = await db
    .select({ totalPhases: sql<number>`count(*)::int` })
    .from(phases)
    .where(eq(phases.blueprint_id, params.blueprintId));

  const cp = completedPhases ?? 0;
  const tp = totalPhases ?? 0;

  if (cp > 0 || (tp === 0 && feedbackCount >= 3)) passed.push("has_phase_progress");
  else {
    failed.push("has_phase_progress");
    blockers.push("At least one phase must be completed or substantial execution must exist");
  }

  return {
    eligible: failed.length === 0,
    passedChecks: passed,
    failedChecks: failed,
    blockers,
  };
}

export async function completeBlueprint(params: {
  blueprintId: string;
  userId: string;
}): Promise<{ completed: boolean; completionSummary: Record<string, unknown> }> {
  const eligibility = await checkCompletionEligibility(params);
  if (!eligibility.eligible) {
    return {
      completed: false,
      completionSummary: { blockers: eligibility.blockers },
    };
  }

  const now = new Date();

  const [feedbackCountRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, params.blueprintId), eq(feedback.validity, "valid")));

  const milestoneRows = await db
    .select()
    .from(milestones)
    .where(eq(milestones.blueprint_id, params.blueprintId))
    .orderBy(asc(milestones.created_at));

  const [capability] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  const [identityState] = await db
    .select()
    .from(userIdentityStates)
    .where(
      and(
        eq(userIdentityStates.blueprint_id, params.blueprintId),
        eq(userIdentityStates.is_current, true),
      ),
    )
    .orderBy(desc(userIdentityStates.created_at))
    .limit(1);

  const fc = feedbackCountRow?.c ?? 0;

  const completionSummary: Record<string, unknown> = {
    tasks_completed: fc,
    milestones_achieved: milestoneRows.length,
    capability_level: capability?.level ?? "beginner",
    identity_stage: identityState?.stage ?? "starting",
    completed_at: now.toISOString(),
  };

  let blueprintCompleteMilestoneId: string | undefined;

  await db.transaction(async (tx: Tx) => {
    await tx
      .update(blueprints)
      .set({
        status: "complete",
        active: false,
        completed_at: now,
        state_version: sql`${blueprints.state_version} + 1`,
      })
      .where(eq(blueprints.id, params.blueprintId));

    await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(orders.blueprint_id, params.blueprintId),
          inArray(orders.status, ["pending", "active", "needs_feedback", "needs_proof", "blocked"]),
        ),
      );

    await tx
      .update(stateMemory)
      .set({ is_current: false, exited_at: now })
      .where(and(eq(stateMemory.blueprint_id, params.blueprintId), eq(stateMemory.is_current, true)));

    const [mile] = await tx
      .insert(milestones)
      .values({
        user_id: params.userId,
        blueprint_id: params.blueprintId,
        type: "blueprint_complete",
        title: "Blueprint Complete",
        description: `Goal achieved after ${fc} verified execution cycles.`,
        metadata_json: completionSummary,
        seen_by_user: false,
      })
      .returning({ id: milestones.id });

    blueprintCompleteMilestoneId = mile?.id;

    await writeEventInTx(
      {
        eventType: EVENT_TYPES.BLUEPRINT_COMPLETED,
        entityType: "blueprint",
        entityId: params.blueprintId,
        userId: params.userId,
        blueprintId: params.blueprintId,
        payload: completionSummary,
        idempotencyKey: `blueprint_completed:${params.blueprintId}`,
      },
      tx,
    );
  });

  if (blueprintCompleteMilestoneId) {
    await notifyMilestoneAchieved({
      userId: params.userId,
      blueprintId: params.blueprintId,
      milestoneId: blueprintCompleteMilestoneId,
      milestoneTitle: "Blueprint Complete",
      milestoneDesc: `Goal achieved after ${fc} verified execution cycles.`,
    }).catch(() => null);
  }

  const [bpMeta] = await db
    .select({ created_at: blueprints.created_at })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const executionDays = bpMeta?.created_at
    ? Math.ceil((now.getTime() - bpMeta.created_at.getTime()) / 86400000)
    : 0;

  await notifyBlueprintCompleted({
    userId: params.userId,
    blueprintId: params.blueprintId,
    tasksCompleted: fc,
    executionDays,
  }).catch(() => null);

  await evaluateIdentity({
    userId: params.userId,
    blueprintId: params.blueprintId,
    reason: "blueprint_completed",
  }).catch(() => null);

  await deactivateBlueprintBhudhiMemory(params.userId, params.blueprintId).catch(() => null);

  await db
    .update(inactivityRecords)
    .set({ resolved: true, resolved_at: now })
    .where(
      and(eq(inactivityRecords.blueprint_id, params.blueprintId), eq(inactivityRecords.resolved, false)),
    )
    .catch(() => null);

  logger.info({ blueprintId: params.blueprintId, userId: params.userId, summary: completionSummary }, "[CompletionEngine] Blueprint completed");

  return { completed: true, completionSummary };
}

export async function getCompletionSummary(blueprintId: string, userId: string) {
  const [blueprint] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId), eq(blueprints.status, "complete")))
    .limit(1);

  if (!blueprint) return null;

  const [{ taskCount }] = await db
    .select({ taskCount: sql<number>`count(*)::int` })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, blueprintId), eq(feedback.validity, "valid")));

  const [{ avgScore }] = await db
    .select({ avgScore: sql<number>`coalesce(avg(${feedback.score}), 0)` })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, blueprintId), eq(feedback.validity, "valid")));

  const milestoneRows = await db
    .select()
    .from(milestones)
    .where(eq(milestones.blueprint_id, blueprintId))
    .orderBy(asc(milestones.created_at));

  const [identity] = await db
    .select()
    .from(userIdentityStates)
    .where(eq(userIdentityStates.blueprint_id, blueprintId))
    .orderBy(desc(userIdentityStates.created_at))
    .limit(1);

  const [capability] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, userId))
    .limit(1);

  const tc = taskCount ?? 0;
  const avg = Number(avgScore ?? 0);

  return {
    blueprintId,
    goal: blueprint.goal,
    completedAt: blueprint.completed_at,
    daysToCompletion:
      blueprint.completed_at && blueprint.created_at
        ? Math.ceil((blueprint.completed_at.getTime() - blueprint.created_at.getTime()) / 86400000)
        : 0,
    tasksCompleted: tc,
    averageScore: Math.round(avg * 10) / 10,
    milestones: milestoneRows.map((m) => ({ type: m.type, title: m.title, date: m.created_at })),
    finalIdentityStage: identity?.stage ?? "starting",
    finalCapabilityLevel: capability?.level ?? "beginner",
    capabilityCarriesForward: true,
    identityCarriesForward: true,
    signalsCarryForward: false,
  };
}

export class CompletionEngine {
  checkCompletionEligibility(p: { blueprintId: string; userId: string }) {
    return checkCompletionEligibility(p);
  }
  completeBlueprint(p: { blueprintId: string; userId: string }) {
    return completeBlueprint(p);
  }
  getCompletionSummary(blueprintId: string, userId: string) {
    return getCompletionSummary(blueprintId, userId);
  }
}
