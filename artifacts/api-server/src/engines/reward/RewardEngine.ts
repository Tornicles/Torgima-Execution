import {
  db,
  feedback,
  falseProgressFlags,
  rewardEvents,
  conditions,
  milestones,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { notifyMilestoneAchieved } from "../../services/notification/LifecycleNotificationWiring.js";

export type RewardType =
  | "COMPLETION"
  | "CONSISTENCY"
  | "RECOVERY"
  | "CAPABILITY_GROWTH"
  | "IDENTITY_ALIGNMENT"
  | "MILESTONE"
  | "OUTCOME_TRUTH"
  | "HONEST_FAILURE"
  | "FOCUS_PROTECTION";

function rewardIdempotencyKey(userId: string, sourceType: string, sourceId: string, rewardType: string): string {
  return `${userId}:${sourceType}:${sourceId}:${rewardType}`;
}

async function resolveRewardKind(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
}): Promise<{ rewardType: RewardType; intensity: "LOW" | "MEDIUM" | "HIGH" } | null> {
  if (params.sourceType === "FEEDBACK") {
    const [fb] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, params.sourceId))
      .limit(1);

    if (!fb) return null;
    if (fb.validity !== "valid") return null;
    if (fb.gaming_flag) return null;

    const interrogation = fb.interrogation_json as { status?: string } | null;
    if (
      interrogation?.status === "pending" ||
      interrogation?.status === "needs_interrogation"
    ) {
      return null;
    }

    if (fb.completion_status === "failed" || fb.completion_status === "skipped") {
      const hadBlocker =
        Boolean(fb.blocker_json) &&
        Object.keys((fb.blocker_json as Record<string, unknown>) ?? {}).length > 0;
      if (hadBlocker) return { rewardType: "HONEST_FAILURE", intensity: "LOW" };
      return { rewardType: "HONEST_FAILURE", intensity: "LOW" };
    }
    if (fb.completion_status === "completed") {
      const score = fb.weighted_score ?? fb.score ?? 0;
      if (score < 6) return null;
      const intensity = score >= 8 ? "HIGH" : score >= 6 ? "MEDIUM" : "LOW";
      return { rewardType: "COMPLETION", intensity };
    }
    return null;
  }

  if (params.sourceType === "INACTIVITY") return { rewardType: "RECOVERY", intensity: "MEDIUM" };
  if (params.sourceType === "CAPABILITY") return { rewardType: "CAPABILITY_GROWTH", intensity: "HIGH" };
  if (params.sourceType === "MILESTONE") return { rewardType: "MILESTONE", intensity: "HIGH" };
  if (params.sourceType === "OUTCOME") return { rewardType: "OUTCOME_TRUTH", intensity: "HIGH" };
  if (params.sourceType === "SIGNAL") return { rewardType: "CONSISTENCY", intensity: "MEDIUM" };
  if (params.sourceType === "IDENTITY") return { rewardType: "IDENTITY_ALIGNMENT", intensity: "MEDIUM" };

  return null;
}

const REWARD_MESSAGES: Record<
  RewardType,
  { low: string; medium: string; high: string }
> = {
  COMPLETION: {
    low:    "Task completed.",
    medium: "Good execution.",
    high:   "Strong work on this task.",
  },
  CONSISTENCY: {
    low:    "Steady progress.",
    medium: "Consistent execution this week.",
    high:   "Excellent execution streak.",
  },
  RECOVERY: {
    low:    "Welcome back.",
    medium: "Recovery complete. Back in motion.",
    high:   "Strong return after a pause.",
  },
  CAPABILITY_GROWTH: {
    low:    "Skill developing.",
    medium: "Capability improving.",
    high:   "Capability level achieved.",
  },
  IDENTITY_ALIGNMENT: {
    low:    "Action aligned with your direction.",
    medium: "Execution reflects your path.",
    high:   "Strong alignment between action and identity.",
  },
  MILESTONE: {
    low:    "Milestone reached.",
    medium: "Significant milestone achieved.",
    high:   "Major milestone — real progress.",
  },
  OUTCOME_TRUTH: {
    low:    "Outcome confirmed.",
    medium: "Real outcome validated.",
    high:   "Verified result — strong execution.",
  },
  HONEST_FAILURE: {
    low:    "Attempt recorded honestly.",
    medium: "Honest feedback — the system can adapt.",
    high:   "Failure reported clearly. Correction path ready.",
  },
  FOCUS_PROTECTION: {
    low:    "Priority task completed.",
    medium: "High-value action completed.",
    high:   "Most important action completed — strong focus.",
  },
};

async function maybeConsistencyReward(userId: string): Promise<{
  rewardType: RewardType;
  intensity: "LOW" | "MEDIUM" | "HIGH";
} | null> {
  const recent = await db
    .select({ id: feedback.id, completion_status: feedback.completion_status, validity: feedback.validity, gaming_flag: feedback.gaming_flag })
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, userId),
        eq(feedback.completion_status, "completed"),
        eq(feedback.validity, "valid"),
      ),
    )
    .orderBy(desc(feedback.created_at))
    .limit(5);

  const verified = recent.filter((r) => !r.gaming_flag);
  if (verified.length >= 5) {
    return { rewardType: "CONSISTENCY", intensity: "HIGH" };
  }
  return null;
}

export async function evaluateReward(params: {
  userId:           string;
  blueprintId?:   string;
  sourceType:     string;
  sourceId:       string;
  idempotencyKey: string;
  stateVersion:   number;
  causationEventId?: string;
  sourceEventId?: string;
}): Promise<{ rewardCreated: boolean; rewardId?: string; rewardType?: string }> {
  void params.stateVersion;
  void params.causationEventId;

  const sourceEventId = params.sourceEventId ?? params.sourceId;

  const kinds: Array<{ rewardType: RewardType; intensity: "LOW" | "MEDIUM" | "HIGH" }> = [];
  const primary = await resolveRewardKind(params);
  if (primary) kinds.push(primary);

  if (params.sourceType === "FEEDBACK") {
    const streak = await maybeConsistencyReward(params.userId);
    if (streak) kinds.push(streak);
  }

  if (kinds.length === 0) {
    return { rewardCreated: false };
  }

  if (params.blueprintId) {
    const [openFlag] = await db
      .select()
      .from(falseProgressFlags)
      .where(
        and(
          eq(falseProgressFlags.blueprint_id, params.blueprintId),
          eq(falseProgressFlags.resolved, false),
        ),
      )
      .limit(1);

    if (openFlag) {
      logger.info(
        { blueprintId: params.blueprintId, sourceId: params.sourceId },
        "[RewardEngine] Reward blocked — false progress flag open",
      );
      return { rewardCreated: false };
    }
  }

  let conditionName = "stability";
  if (params.blueprintId) {
    const [condition] = await db
      .select()
      .from(conditions)
      .where(
        and(
          eq(conditions.blueprint_id, params.blueprintId),
          eq(conditions.is_current, true),
        ),
      )
      .limit(1);
    conditionName = condition?.condition ?? "stability";
  }

  let createdId: string | undefined;
  let createdType: string | undefined;
  let anyCreated = false;

  for (const { rewardType, intensity } of kinds) {
    const idempotencyKey = rewardIdempotencyKey(
      params.userId,
      params.sourceType,
      params.sourceId,
      rewardType,
    );

    const [existing] = await db
      .select()
      .from(rewardEvents)
      .where(eq(rewardEvents.idempotency_key, idempotencyKey))
      .limit(1);

    if (existing) {
      createdId = existing.id;
      createdType = existing.reward_type;
      continue;
    }

    let effectiveIntensity = intensity;
    if (
      conditionName === "danger" &&
      !["RECOVERY", "HONEST_FAILURE"].includes(rewardType)
    ) {
      effectiveIntensity = "LOW";
    }

    const effectiveMessage =
      REWARD_MESSAGES[rewardType][
        effectiveIntensity.toLowerCase() as "low" | "medium" | "high"
      ];

    const [reward] = await db
      .insert(rewardEvents)
      .values({
        user_id: params.userId,
        blueprint_id: params.blueprintId,
        milestone_id: params.sourceType === "MILESTONE" ? params.sourceId : null,
        idempotency_key: idempotencyKey,
        reward_type: rewardType,
        title: rewardType.replace(/_/g, " "),
        description: effectiveMessage,
        message: effectiveMessage,
        reward_level:
          effectiveIntensity === "HIGH"
            ? "MAJOR"
            : effectiveIntensity === "MEDIUM"
              ? "NOTABLE"
              : "MINOR",
        intensity: effectiveIntensity,
        source_event_id: sourceEventId,
        ui_action: params.idempotencyKey ? `idemp:${params.idempotencyKey}` : null,
        delivered: false,
      })
      .returning();

    if (reward) {
      anyCreated = true;
      createdId = reward.id;
      createdType = reward.reward_type;

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

      logger.info(
        {
          rewardId: reward.id,
          rewardType,
          intensity: effectiveIntensity,
          sourceEventId,
          userId: params.userId,
        },
        "[RewardEngine] Reward created",
      );

      if (rewardType === "COMPLETION" && params.sourceType === "FEEDBACK") {
        const [fb] = await db
          .select({
            order_id: feedback.order_id,
            weighted_score: feedback.weighted_score,
            score: feedback.score,
          })
          .from(feedback)
          .where(eq(feedback.id, params.sourceId))
          .limit(1);

        if (fb?.order_id) {
          const score = fb.weighted_score ?? fb.score ?? 5;
          const difficulty = score >= 8 ? 5 : score >= 6 ? 3 : 2;
          const { tryAwardGamificationXp } = await import(
            "../gamification/gamificationHooks.js"
          );
          void tryAwardGamificationXp({
            userId: params.userId,
            eventType: "order-completion",
            sourceId: fb.order_id,
            eventData: { difficulty },
          });

          const { onOrderCompleted } = await import(
            "../integrations/integrationHooks.js"
          );
          void onOrderCompleted(params.userId, {
            orderId: fb.order_id,
            score,
            feedbackId: params.sourceId,
            blueprintId: params.blueprintId,
          });
        }
      }
    }
  }

  return {
    rewardCreated: anyCreated,
    rewardId: createdId,
    rewardType: createdType,
  };
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
