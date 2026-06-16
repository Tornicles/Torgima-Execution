/**
 * DOC19 Task 2 — central reward service (verified execution only).
 */

import { db, rewardEvents, conditions, milestones } from "@workspace/db";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { notifyMilestoneAchieved } from "../../services/notification/LifecycleNotificationWiring.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { DecisionTraceService } from "../decision/DecisionTraceService.js";
import { getBlueprintStateVersion } from "../decision-trace/DecisionTraceSystem.js";
import {
  buildRewardIdempotencyKey,
  checkBlockingConditions,
  getEligibleRewardTypes,
  loadSourceRecord,
} from "./RewardEligibilityChecker.js";
import { updateStreakMetrics, computeStreaks } from "./StreakTracker.js";
import { buildRewardPanelView, toDashboardRewardSummary } from "./RewardProjectionBuilder.js";
import type { RewardIntensity, RewardType } from "./rewardTypes.js";

export type { RewardType, RewardIntensity } from "./rewardTypes.js";
export { REWARD_TYPES } from "./rewardTypes.js";
export { computeStreaks, streakRestartMessage } from "./StreakTracker.js";
export { buildRewardPanelView, toDashboardRewardSummary } from "./RewardProjectionBuilder.js";

const FORBIDDEN_COPY = /\b(you crushed it|amazing|killing it|don't break your streak|you lost your streak)\b/i;

const DETERMINISTIC_TEMPLATES: Record<
  RewardType,
  Record<RewardIntensity, { title: string; message: string }>
> = {
  COMPLETION: {
    LOW: { title: "Task Complete", message: "Good work. Your next step is ready." },
    MEDIUM: {
      title: "Task Complete",
      message: "Strong execution. Keep the momentum going.",
    },
    HIGH: { title: "Task Complete", message: "Strong work on this task." },
  },
  CONSISTENCY: {
    LOW: { title: "Consistent Work", message: "Repeated execution builds real results." },
    MEDIUM: { title: "Consistent Work", message: "Repeated execution builds real results." },
    HIGH: { title: "Consistent Work", message: "Excellent execution streak." },
  },
  RECOVERY: {
    LOW: { title: "Welcome Back", message: "You returned. That is what matters. Next step is ready." },
    MEDIUM: {
      title: "Welcome Back",
      message: "You returned. That is what matters. Next step is ready.",
    },
    HIGH: { title: "Welcome Back", message: "Strong return after a pause." },
  },
  CAPABILITY_GROWTH: {
    LOW: { title: "Capability Growing", message: "Skill developing." },
    MEDIUM: { title: "Capability Growing", message: "Capability improving." },
    HIGH: { title: "Capability Growing", message: "Capability level achieved." },
  },
  IDENTITY_ALIGNMENT: {
    LOW: { title: "Aligned Action", message: "Action aligned with your direction." },
    MEDIUM: { title: "Aligned Action", message: "Execution reflects your path." },
    HIGH: { title: "Aligned Action", message: "Strong alignment between action and identity." },
  },
  MILESTONE: {
    LOW: { title: "Milestone Reached", message: "Real progress confirmed." },
    MEDIUM: { title: "Milestone Reached", message: "Significant milestone achieved." },
    HIGH: {
      title: "Milestone Reached",
      message: "Real progress confirmed. A new phase begins.",
    },
  },
  OUTCOME_TRUTH: {
    LOW: { title: "Outcome Verified", message: "Outcome confirmed." },
    MEDIUM: { title: "Outcome Verified", message: "Real outcome validated." },
    HIGH: {
      title: "Outcome Verified",
      message: "Results confirmed. This is what real progress looks like.",
    },
  },
  HONEST_FAILURE: {
    LOW: {
      title: "Noted",
      message: "Honest feedback recorded. The system has adjusted your next step.",
    },
    MEDIUM: {
      title: "Noted",
      message: "Honest feedback — the system can adapt.",
    },
    HIGH: {
      title: "Noted",
      message: "Failure reported clearly. Correction path ready.",
    },
  },
  FOCUS_PROTECTION: {
    LOW: { title: "Priority Complete", message: "Priority task completed." },
    MEDIUM: { title: "Priority Complete", message: "High-value action completed." },
    HIGH: {
      title: "Priority Complete",
      message: "Most important action completed — strong focus.",
    },
  },
};

async function getCurrentConditionName(blueprintId?: string): Promise<string> {
  if (!blueprintId) return "stability";
  const [condition] = await db
    .select({ condition: conditions.condition })
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
    .limit(1);
  return condition?.condition ?? "stability";
}

async function hadHighRewardLast24Hours(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600000);
  const [row] = await db
    .select({ id: rewardEvents.id })
    .from(rewardEvents)
    .where(
      and(
        eq(rewardEvents.user_id, userId),
        eq(rewardEvents.intensity, "HIGH"),
        gte(rewardEvents.created_at, since),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export function selectIntensity(
  rewardType: RewardType,
  conditionName: string,
  baseIntensity: RewardIntensity,
  antiEscalationActive: boolean,
): RewardIntensity {
  let intensity = baseIntensity;

  const defaultHigh: RewardType[] = ["MILESTONE", "OUTCOME_TRUTH", "IDENTITY_ALIGNMENT"];
  const defaultMedium: RewardType[] = [
    "CONSISTENCY",
    "RECOVERY",
    "CAPABILITY_GROWTH",
    "FOCUS_PROTECTION",
  ];

  if (defaultHigh.includes(rewardType) && baseIntensity === "LOW") {
    intensity = "HIGH";
  } else if (defaultMedium.includes(rewardType) && baseIntensity === "LOW") {
    intensity = "MEDIUM";
  }

  if (conditionName === "danger" || conditionName === "nothingness") {
    if (intensity === "HIGH") intensity = "MEDIUM";
    if (
      conditionName === "danger" &&
      !["RECOVERY", "HONEST_FAILURE"].includes(rewardType) &&
      intensity === "MEDIUM"
    ) {
      intensity = "LOW";
    }
  }

  if (antiEscalationActive && intensity === "HIGH") {
    intensity = "MEDIUM";
  }

  return intensity;
}

export async function generateRewardCopy(
  rewardType: RewardType,
  intensity: RewardIntensity,
): Promise<{ title: string; message: string }> {
  const template = DETERMINISTIC_TEMPLATES[rewardType][intensity];
  let { title, message } = template;

  if (FORBIDDEN_COPY.test(message) || FORBIDDEN_COPY.test(title)) {
    message = "Good work. Your next step is ready.";
  }

  return { title, message };
}

async function emitRewardBlocked(params: {
  userId: string;
  blueprintId?: string;
  sourceType: string;
  sourceId: string;
  reason: string;
}): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.REWARD_EVALUATION_BLOCKED,
    entityType: "reward",
    entityId: params.sourceId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      reason: params.reason,
      source_type: params.sourceType,
      source_id: params.sourceId,
    },
    idempotencyKey: `reward_blocked:${params.sourceType}:${params.sourceId}:${params.reason}`,
  }).catch(() => null);
}

export async function evaluateReward(params: {
  userId: string;
  blueprintId?: string;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  stateVersion: number;
  causationEventId?: string;
  sourceEventId?: string;
}): Promise<{ rewardCreated: boolean; rewardId?: string; rewardType?: string; blocked?: boolean }> {
  void params.stateVersion;
  void params.idempotencyKey;

  const source = await loadSourceRecord(params.sourceType, params.sourceId, params.userId);
  if (!source) {
    await emitRewardBlocked({
      userId: params.userId,
      blueprintId: params.blueprintId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      reason: "SOURCE_NOT_FOUND",
    });
    return { rewardCreated: false, blocked: true };
  }

  const eligible = await getEligibleRewardTypes(params.sourceType, source as Record<string, unknown>, {
    userId: params.userId,
    blueprintId: params.blueprintId,
  });

  if (eligible.length === 0) {
    return { rewardCreated: false };
  }

  const conditionName = await getCurrentConditionName(params.blueprintId);
  const antiEscalation = await hadHighRewardLast24Hours(params.userId);
  const sourceEventId = params.sourceEventId ?? params.sourceId;

  let createdId: string | undefined;
  let createdType: string | undefined;
  let anyCreated = false;

  for (const { rewardType, intensity: baseIntensity } of eligible) {
    const blocked = await checkBlockingConditions(
      params.userId,
      params.blueprintId,
      rewardType,
    );
    if (blocked.isBlocked) {
      await emitRewardBlocked({
        userId: params.userId,
        blueprintId: params.blueprintId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        reason: blocked.reason ?? "BLOCKED",
      });
      if (params.blueprintId) {
        await DecisionTraceService.write({
          userId: params.userId,
          blueprintId: params.blueprintId,
          decisionType: "SYSTEM_CONTROL",
          decisionKey: `reward_blocked:${rewardType}:${params.sourceId}`,
          selectedOption: "BLOCKED",
          optionsConsidered: [rewardType, "BLOCKED"],
          rationaleSummary: blocked.reason ?? "Reward blocked by eligibility rules",
          sourceEngine: "RewardEngine",
          confidence: "HIGH",
          stateVersion: await getBlueprintStateVersion(params.blueprintId).catch(() => 0),
        }).catch(() => null);
      }
      continue;
    }

    const idempotencyKey = buildRewardIdempotencyKey(
      params.userId,
      params.sourceType,
      params.sourceId,
      rewardType,
    );

    const [existing] = await db
      .select({ id: rewardEvents.id, reward_type: rewardEvents.reward_type })
      .from(rewardEvents)
      .where(eq(rewardEvents.idempotency_key, idempotencyKey))
      .limit(1);

    if (existing) {
      createdId = existing.id;
      createdType = existing.reward_type;
      continue;
    }

    const intensity = selectIntensity(rewardType, conditionName, baseIntensity, antiEscalation);
    const copy = await generateRewardCopy(rewardType, intensity);

    const [reward] = await db
      .insert(rewardEvents)
      .values({
        user_id: params.userId,
        blueprint_id: params.blueprintId,
        milestone_id: params.sourceType === "MILESTONE" ? params.sourceId : null,
        idempotency_key: idempotencyKey,
        reward_type: rewardType,
        title: copy.title,
        description: copy.message,
        message: copy.message,
        reward_level:
          intensity === "HIGH" ? "MAJOR" : intensity === "MEDIUM" ? "NOTABLE" : "MINOR",
        intensity,
        source_event_id: sourceEventId,
        ui_action: `reward:${rewardType}`,
        delivered: false,
      })
      .returning();

    if (!reward) continue;

    anyCreated = true;
    createdId = reward.id;
    createdType = reward.reward_type;

    await updateStreakMetrics(params.userId, params.blueprintId, rewardType);

    if (rewardType === "MILESTONE" && params.blueprintId) {
      const [m] = await db
        .select({ title: milestones.title, description: milestones.description })
        .from(milestones)
        .where(and(eq(milestones.id, params.sourceId), eq(milestones.user_id, params.userId)))
        .limit(1);

      await notifyMilestoneAchieved({
        userId: params.userId,
        blueprintId: params.blueprintId,
        milestoneId: params.sourceId,
        milestoneTitle: m?.title ?? "Milestone",
        milestoneDesc: m?.description ?? undefined,
      }).catch(() => null);
    }

    await writeEvent({
      eventType: EVENT_TYPES.REWARD_CREATED,
      entityType: "reward",
      entityId: reward.id,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: {
        reward_type: rewardType,
        intensity,
        source_type: params.sourceType,
        source_id: params.sourceId,
      },
      idempotencyKey: `reward_created:${reward.id}`,
      causationEventId: params.causationEventId,
    }).catch(() => null);

    if (params.blueprintId && intensity === "HIGH") {
      await DecisionTraceService.write({
        userId: params.userId,
        blueprintId: params.blueprintId,
        decisionType: "SYSTEM_CONTROL",
        decisionKey: `reward_granted:${rewardType}:${params.sourceId}`,
        selectedOption: `${rewardType}:HIGH`,
        optionsConsidered: [rewardType, intensity],
        rationaleSummary: `Granted HIGH intensity ${rewardType} reward`,
        sourceEngine: "RewardEngine",
        confidence: "HIGH",
        stateVersion: await getBlueprintStateVersion(params.blueprintId).catch(() => 0),
        causationEventId: reward.id,
      }).catch(() => null);
    }

    if (rewardType === "IDENTITY_ALIGNMENT" && params.blueprintId) {
      await writeEvent({
        eventType: EVENT_TYPES.IDENTITY_EVALUATION_REQUESTED,
        entityType: "reward",
        entityId: reward.id,
        userId: params.userId,
        blueprintId: params.blueprintId,
        payload: { reason: "reward_identity_alignment" },
        idempotencyKey: `identity:reward_alignment:${reward.id}`,
      }).catch(() => null);
    }

    await writeEvent({
      eventType: EVENT_TYPES.DASHBOARD_REFRESH_REQUESTED,
      entityType: "blueprint",
      entityId: params.blueprintId ?? params.userId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: { trigger: "reward_created", reward_id: reward.id },
      idempotencyKey: `dashboard_reward:${reward.id}`,
    }).catch(() => null);

    if (rewardType === "COMPLETION" && params.sourceType === "FEEDBACK") {
      const { tryAwardGamificationXp } = await import("../gamification/gamificationHooks.js");
      const { onOrderCompleted } = await import("../integrations/integrationHooks.js");
      const fb = source as typeof import("@workspace/db").feedback.$inferSelect;
      if (fb.order_id) {
        const score = fb.weighted_score ?? fb.score ?? 5;
        void tryAwardGamificationXp({
          userId: params.userId,
          eventType: "order-completion",
          sourceId: fb.order_id,
          eventData: { difficulty: score >= 8 ? 5 : score >= 6 ? 3 : 2 },
        });
        void onOrderCompleted(params.userId, {
          orderId: fb.order_id,
          score,
          feedbackId: params.sourceId,
          blueprintId: params.blueprintId,
        });
      }
    }

    logger.info(
      { rewardId: reward.id, rewardType, intensity, userId: params.userId },
      "[RewardEngine] Reward created",
    );
  }

  return {
    rewardCreated: anyCreated,
    rewardId: createdId,
    rewardType: createdType,
  };
}

export async function getLatestRewardForBlueprint(userId: string, blueprintId: string) {
  const [row] = await db
    .select()
    .from(rewardEvents)
    .where(and(eq(rewardEvents.user_id, userId), eq(rewardEvents.blueprint_id, blueprintId)))
    .orderBy(desc(rewardEvents.created_at))
    .limit(1);

  if (!row) return null;
  return {
    type: row.reward_type,
    intensity: row.intensity ?? "LOW",
    message: row.message ?? row.description,
    title: row.title,
    createdAt: row.created_at,
    executionStreak: (await computeStreaks(userId, blueprintId)).execution_streak,
  };
}

export async function getRecentRewards(userId: string, blueprintId?: string, limit = 10) {
  const where = blueprintId
    ? and(eq(rewardEvents.user_id, userId), eq(rewardEvents.blueprint_id, blueprintId))
    : eq(rewardEvents.user_id, userId);

  const rows = await db
    .select()
    .from(rewardEvents)
    .where(where)
    .orderBy(desc(rewardEvents.created_at))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    rewardType: r.reward_type,
    title: r.title,
    message: r.message ?? r.description,
    intensity: r.intensity,
    delivered: r.delivered,
    createdAt: r.created_at,
  }));
}

export async function getPendingRewards(userId: string, blueprintId?: string) {
  const where = blueprintId
    ? and(
        eq(rewardEvents.user_id, userId),
        eq(rewardEvents.blueprint_id, blueprintId),
        eq(rewardEvents.delivered, false),
      )
    : and(eq(rewardEvents.user_id, userId), eq(rewardEvents.delivered, false));

  return db
    .select()
    .from(rewardEvents)
    .where(where)
    .orderBy(desc(rewardEvents.created_at))
    .limit(5);
}

export async function markRewardsDelivered(rewardIds: string[]): Promise<void> {
  if (rewardIds.length === 0) return;
  await db
    .update(rewardEvents)
    .set({ delivered: true, delivered_at: new Date() })
    .where(inArray(rewardEvents.id, rewardIds));
}
