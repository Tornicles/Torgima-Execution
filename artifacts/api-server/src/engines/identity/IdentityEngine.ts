import {
  db,
  feedback,
  capabilityProfiles,
  inactivityRecords,
  falseProgressFlags,
  userIdentityStates,
  identityHistory,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

const STAGE_ORDER = [
  "starting",
  "forming",
  "building",
  "establishing",
  "consolidated",
  "transforming",
] as const;

type IdentityStage = (typeof STAGE_ORDER)[number];

const STAGE_REQUIREMENTS: Record<
  IdentityStage,
  { minFeedbackCount: number; minConsistency: number; minStreak: number }
> = {
  starting:     { minFeedbackCount: 0,  minConsistency: 0,    minStreak: 0 },
  forming:      { minFeedbackCount: 1,  minConsistency: 0.3,  minStreak: 1 },
  building:     { minFeedbackCount: 5,  minConsistency: 0.5,  minStreak: 2 },
  establishing: { minFeedbackCount: 15, minConsistency: 0.65, minStreak: 3 },
  consolidated: { minFeedbackCount: 30, minConsistency: 0.75, minStreak: 5 },
  transforming: { minFeedbackCount: 60, minConsistency: 0.85, minStreak: 7 },
};

export async function evaluateIdentity(params: {
  userId:      string;
  blueprintId: string;
  windowDays?: number;
  reason?:     string;
}): Promise<{ stage: string; changed: boolean; regressionRisk: string }> {
  const window = params.windowDays ?? 14;
  const since  = new Date(Date.now() - window * 86400000);

  const [feedbackRows, capability, inactivity] = await Promise.all([
    db
      .select()
      .from(feedback)
      .where(
        and(
          eq(feedback.user_id, params.userId),
          eq(feedback.blueprint_id, params.blueprintId),
          gte(feedback.created_at, since),
        ),
      )
      .orderBy(desc(feedback.created_at)),
    db
      .select()
      .from(capabilityProfiles)
      .where(eq(capabilityProfiles.user_id, params.userId))
      .limit(1),
    db
      .select()
      .from(inactivityRecords)
      .where(
        and(
          eq(inactivityRecords.user_id, params.userId),
          eq(inactivityRecords.blueprint_id, params.blueprintId),
          eq(inactivityRecords.resolved, false),
        ),
      )
      .limit(1),
  ]);

  const completedCount =
    feedbackRows.filter(f => f.completion_status === "completed").length;
  const consistencyScore =
    feedbackRows.length > 0 ? completedCount / feedbackRows.length : 0;
  const streak = capability[0]?.streak_current ?? 0;

  const stabilityScore = consistencyScore * 100;
  const inact = inactivity[0];
  const continuityScore = inact
    ? Math.max(0, 100 - (inact.inactivity_days * 5))
    : Math.min(100, streak * 15);

  const totalCompleted = capability[0]?.tasks_completed ?? 0;
  const transformationScore = Math.min(100, totalCompleted * 1.5);

  const avgFriction =
    feedbackRows.length > 0
      ? feedbackRows.reduce((s, f) => s + (f.friction_score ?? 0), 0) / feedbackRows.length
      : 0;
  const failureRate =
    feedbackRows.length > 0
      ? feedbackRows.filter(f => f.completion_status === "failed").length / feedbackRows.length
      : 0;
  const regressionScore =
    (avgFriction / 5) * 0.4 + failureRate * 0.4 + (inact ? 0.2 : 0);
  const regressionRisk =
    regressionScore >= 0.7
      ? "CRITICAL"
      : regressionScore >= 0.5
        ? "HIGH"
        : regressionScore >= 0.3
          ? "MEDIUM"
          : "LOW";

  const [openFalseProgress] = await db
    .select({ id: falseProgressFlags.id })
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, params.blueprintId),
        eq(falseProgressFlags.resolved, false),
      ),
    )
    .limit(1);

  let targetStage: IdentityStage = "starting";
  const evidenceCompleted = completedCount;

  for (const stage of [...STAGE_ORDER].reverse()) {
    const req = STAGE_REQUIREMENTS[stage];
    if (
      evidenceCompleted >= req.minFeedbackCount &&
      consistencyScore >= req.minConsistency &&
      streak >= req.minStreak &&
      !openFalseProgress
    ) {
      targetStage = stage;
      break;
    }
  }

  if (["HIGH", "CRITICAL"].includes(regressionRisk) && consistencyScore < 0.3) {
    targetStage = consistencyScore < 0.1 ? "starting" : "forming";
  }

  const [currentState] = await db
    .select()
    .from(userIdentityStates)
    .where(
      and(
        eq(userIdentityStates.user_id, params.userId),
        eq(userIdentityStates.blueprint_id, params.blueprintId),
        eq(userIdentityStates.is_current, true),
      ),
    )
    .limit(1);

  const previousStage = (currentState?.stage as string) ?? "starting";
  const changed = previousStage !== targetStage;

  if (changed || !currentState) {
    await db.transaction(async tx => {
      if (currentState) {
        await tx
          .update(userIdentityStates)
          .set({ is_current: false })
          .where(eq(userIdentityStates.id, currentState.id));
      }

      await tx.insert(userIdentityStates).values({
        user_id:              params.userId,
        blueprint_id:         params.blueprintId,
        stage:                targetStage,
        reinforcement_count:
          (currentState?.reinforcement_count ?? 0) + (changed ? 0 : 1),
        transformation_score: transformationScore,
        is_current:           true,
      });

      if (changed) {
        await tx.insert(identityHistory).values({
          user_id:              params.userId,
          blueprint_id:         params.blueprintId,
          trigger:              params.reason ?? "identity_evaluation_requested",
          stage_before:         previousStage,
          stage_after:          targetStage,
          transformation_score: transformationScore,
          snapshot: {
            stability:       stabilityScore,
            continuity:      continuityScore,
            transformation:  transformationScore,
            regression_risk: regressionRisk,
          },
        });
      }
    });

    logger.info(
      {
        blueprintId: params.blueprintId,
        from:        previousStage,
        to:          targetStage,
        changed,
        regressionRisk,
      },
      "[IdentityEngine] Stage evaluated",
    );
  }

  return { stage: targetStage, changed, regressionRisk };
}

export async function getCurrentIdentityState(userId: string, blueprintId: string) {
  const [row] = await db
    .select()
    .from(userIdentityStates)
    .where(
      and(
        eq(userIdentityStates.user_id, userId),
        eq(userIdentityStates.blueprint_id, blueprintId),
        eq(userIdentityStates.is_current, true),
      ),
    )
    .limit(1);
  return row ?? null;
}
