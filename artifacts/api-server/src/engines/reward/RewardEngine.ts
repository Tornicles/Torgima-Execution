import {
  db,
  feedback,
  falseProgressFlags,
  rewardEvents,
  conditions,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

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

export async function evaluateReward(params: {
  userId:           string;
  blueprintId?:   string;
  sourceType:     string;
  sourceId:       string;
  idempotencyKey: string;
  stateVersion:   number;
  causationEventId?: string;
}): Promise<{ rewardCreated: boolean; rewardId?: string; rewardType?: string }> {
  void params.stateVersion;
  void params.causationEventId;

  const [existing] = await db
    .select()
    .from(rewardEvents)
    .where(
      and(eq(rewardEvents.user_id, params.userId), eq(rewardEvents.milestone_id, params.sourceId)),
    )
    .limit(1);

  if (existing) {
    return { rewardCreated: false, rewardId: existing.id, rewardType: existing.reward_type };
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

  let rewardType: RewardType = "COMPLETION";
  let intensity: "LOW" | "MEDIUM" | "HIGH" = "LOW";

  if (params.sourceType === "FEEDBACK") {
    const [fb] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, params.sourceId))
      .limit(1);

    if (!fb) return { rewardCreated: false };
    if (fb.validity !== "valid") return { rewardCreated: false };

    if (fb.completion_status === "failed" || fb.completion_status === "skipped") {
      rewardType = "HONEST_FAILURE";
      intensity = "LOW";
    } else if (fb.completion_status === "completed") {
      rewardType = "COMPLETION";
      intensity =
        (fb.score ?? 0) >= 8 ? "HIGH" : (fb.score ?? 0) >= 6 ? "MEDIUM" : "LOW";
    } else {
      rewardType = "COMPLETION";
      intensity = "LOW";
    }
  } else if (params.sourceType === "INACTIVITY") {
    rewardType = "RECOVERY";
    intensity = "MEDIUM";
  } else if (params.sourceType === "CAPABILITY") {
    rewardType = "CAPABILITY_GROWTH";
    intensity = "HIGH";
  } else if (params.sourceType === "MILESTONE") {
    rewardType = "MILESTONE";
    intensity = "HIGH";
  } else if (params.sourceType === "OUTCOME") {
    rewardType = "OUTCOME_TRUTH";
    intensity = "HIGH";
  } else if (params.sourceType === "SIGNAL") {
    rewardType = "CONSISTENCY";
    intensity = "MEDIUM";
  } else if (params.sourceType === "IDENTITY") {
    rewardType = "IDENTITY_ALIGNMENT";
    intensity = "MEDIUM";
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
      user_id:      params.userId,
      blueprint_id: params.blueprintId,
      milestone_id: params.sourceId,
      reward_type:  rewardType,
      title:        rewardType.replace(/_/g, " "),
      description:  effectiveMessage,
      ui_action:    params.idempotencyKey ? `idemp:${params.idempotencyKey}` : null,
      delivered:    false,
    })
    .returning();

  logger.info(
    {
      rewardId:   reward?.id,
      rewardType,
      intensity:  effectiveIntensity,
      userId:     params.userId,
    },
    "[RewardEngine] Reward created",
  );

  return {
    rewardCreated: true,
    rewardId:      reward?.id,
    rewardType,
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
