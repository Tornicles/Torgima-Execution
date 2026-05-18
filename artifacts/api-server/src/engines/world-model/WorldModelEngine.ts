import { db, worldModels, signalSnapshots, blueprints, feedback } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export type WorldModelUpdateTrigger = "FEEDBACK" | "SIGNAL_RECALC" | "SCHEDULED" | "EIS_UPDATE";

export interface WorldModelState {
  userId: string;
  stateVersion: number;
  userState: {
    energyLevel: number;
    attentionQuality: number;
    consistencyScore: number;
    moraleLevel: number;
    cognitiveLoad: number;
    burnoutRisk: number;
  };
  goalState: {
    blueprintHealthScore: number;
    phaseProgressRate: number;
    targetAchievementTrajectory: "ahead" | "on_track" | "behind" | "critical";
    daysToPhaseCompletion: number | null;
  };
  signalTrajectory: {
    completionRateTrend: "rising" | "stable" | "declining";
    completionRateDrift: number;
    momentumTrend: "rising" | "stable" | "declining";
    momentumDrift: number;
    confidenceTrend: "rising" | "stable" | "declining";
  };
  motivationState: {
    motivationLevel: number;
    meaningAlignment: number;
    noveltyDecayRate: number;
  };
  marketState: {
    domainCondition: "favorable" | "neutral" | "challenging";
    lastEISUpdate: string | null;
    platformSignalScore: number;
  };
  environmentalState: {
    lastUpdated: string;
    seasonalContext: string | null;
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function defaultState(userId: string): WorldModelState {
  const now = new Date().toISOString();
  return {
    userId,
    stateVersion: 0,
    userState: {
      energyLevel: 0.5,
      attentionQuality: 0.5,
      consistencyScore: 0.5,
      moraleLevel: 0.5,
      cognitiveLoad: 0.3,
      burnoutRisk: 0.2,
    },
    goalState: {
      blueprintHealthScore: 0.5,
      phaseProgressRate: 0,
      targetAchievementTrajectory: "on_track",
      daysToPhaseCompletion: null,
    },
    signalTrajectory: {
      completionRateTrend: "stable",
      completionRateDrift: 0,
      momentumTrend: "stable",
      momentumDrift: 0,
      confidenceTrend: "stable",
    },
    motivationState: {
      motivationLevel: 0.5,
      meaningAlignment: 0.5,
      noveltyDecayRate: 0.1,
    },
    marketState: {
      domainCondition: "neutral",
      lastEISUpdate: null,
      platformSignalScore: 0.5,
    },
    environmentalState: {
      lastUpdated: now,
      seasonalContext: null,
    },
  };
}

function rowToState(userId: string, row: typeof worldModels.$inferSelect): WorldModelState {
  return {
    userId,
    stateVersion: row.state_version,
    userState: row.user_state as WorldModelState["userState"],
    goalState: row.goal_state as WorldModelState["goalState"],
    signalTrajectory: row.signal_trajectory as WorldModelState["signalTrajectory"],
    motivationState: row.motivation_state as WorldModelState["motivationState"],
    marketState: row.market_state as WorldModelState["marketState"],
    environmentalState: row.environmental_state as WorldModelState["environmentalState"],
  };
}

export async function getWorldModel(userId: string): Promise<WorldModelState | null> {
  const [row] = await db
    .select()
    .from(worldModels)
    .where(eq(worldModels.user_id, userId))
    .limit(1);
  if (!row) return null;
  return rowToState(userId, row);
}

export async function validateWorldStateVersion(
  userId: string,
  expectedVersion: number,
): Promise<boolean> {
  try {
    const model = await getWorldModel(userId);
    if (!model) return expectedVersion === 0;
    return model.stateVersion === expectedVersion;
  } catch {
    return expectedVersion === 0;
  }
}

async function computeDrift(userId: string, blueprintId: string | null): Promise<WorldModelState> {
  const base = (await getWorldModel(userId)) ?? defaultState(userId);
  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let completionRate = 0.5;
  let momentum = 0;
  if (blueprintId) {
    const [snap] = await db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
      .limit(1);
    if (snap) {
      completionRate = snap.completion_rate;
      momentum = snap.momentum;
    }
  }

  const recentFeedback = await db
    .select({ score: feedback.score })
    .from(feedback)
    .where(and(eq(feedback.user_id, userId), gte(feedback.created_at, windowStart)))
    .limit(50);

  const avgScore =
    recentFeedback.length > 0
      ? recentFeedback.reduce((s, f) => s + (f.score ?? 5), 0) / recentFeedback.length / 10
      : 0.5;

  const trend: "rising" | "stable" | "declining" =
    momentum > 0.05 ? "rising" : momentum < -0.05 ? "declining" : "stable";

  return {
    ...base,
    stateVersion: base.stateVersion + 1,
    userState: {
      energyLevel: clamp01(avgScore * 0.6 + completionRate * 0.4),
      attentionQuality: clamp01(completionRate),
      consistencyScore: clamp01(completionRate * 0.85 + avgScore * 0.15),
      moraleLevel: clamp01(avgScore),
      cognitiveLoad: clamp01(1 - completionRate * 0.7),
      burnoutRisk: clamp01(1 - avgScore),
    },
    goalState: {
      ...base.goalState,
      blueprintHealthScore: clamp01(completionRate * 0.7 + avgScore * 0.3),
      phaseProgressRate: clamp01(completionRate),
      targetAchievementTrajectory:
        completionRate >= 0.75 ? "ahead" : completionRate >= 0.45 ? "on_track" : completionRate >= 0.2 ? "behind" : "critical",
    },
    signalTrajectory: {
      completionRateTrend: trend,
      completionRateDrift: momentum,
      momentumTrend: trend,
      momentumDrift: momentum,
      confidenceTrend: trend,
    },
    motivationState: {
      motivationLevel: clamp01(avgScore),
      meaningAlignment: base.motivationState.meaningAlignment,
      noveltyDecayRate: base.motivationState.noveltyDecayRate,
    },
    environmentalState: {
      lastUpdated: new Date().toISOString(),
      seasonalContext: base.environmentalState.seasonalContext,
    },
  };
}

export async function updateWorldModel(
  userId: string,
  trigger: WorldModelUpdateTrigger,
): Promise<WorldModelState> {
  const [bp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .orderBy(desc(blueprints.updated_at))
    .limit(1);

  const next = await computeDrift(userId, bp?.id ?? null);
  const now = new Date();

  await db
    .insert(worldModels)
    .values({
      user_id: userId,
      user_state: next.userState,
      goal_state: next.goalState,
      signal_trajectory: next.signalTrajectory,
      motivation_state: next.motivationState,
      market_state: next.marketState,
      identity_state: {},
      environmental_state: next.environmentalState,
      state_version: next.stateVersion,
      last_drift_calculation: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: worldModels.user_id,
      set: {
        user_state: next.userState,
        goal_state: next.goalState,
        signal_trajectory: next.signalTrajectory,
        motivation_state: next.motivationState,
        market_state: next.marketState,
        environmental_state: next.environmentalState,
        state_version: next.stateVersion,
        last_drift_calculation: now,
        updated_at: now,
      },
    });

  logger.info({ userId, trigger, stateVersion: next.stateVersion }, "[WorldModelEngine] Updated");
  return next;
}

export async function updateStateDrift(userId: string): Promise<WorldModelState> {
  return updateWorldModel(userId, "SCHEDULED");
}
