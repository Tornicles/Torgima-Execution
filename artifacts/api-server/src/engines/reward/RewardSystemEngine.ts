/**
 * Prompt 7 §8 — System writes rewards; Bhudhi drafts language only.
 */
import { db, rewardEvents, identityProfiles } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { routeTrigger } from "../../bhudhi/TriggerRouter.js";
import { applyExecutionLanguage } from "../../bhudhi/AdaptiveCommunicationEngine.js";
import { writeMemory } from "../../bhudhi/MemoryService.js";

export type Prompt7RewardType =
  | "PHASE_COMPLETE"
  | "CONSISTENCY_STREAK"
  | "CONDITION_UPGRADE"
  | "CHARACTER_LEVEL_UP"
  | "IDENTITY_MILESTONE"
  | "FIRST_POWER"
  | "COMEBACK"
  | "BLUEPRINT_COMPLETE";

const FORBIDDEN_REWARD = /\b(congratulations|great job|amazing|proud)\b/i;

export interface ExecutionStats {
  consecutiveExecutionDays?: number;
  conditionTransitionedUp?: boolean;
  firstTimeReachingPower?: boolean;
  phaseJustCompleted?: boolean;
  recoveredFromDanger?: boolean;
  blueprintJustCompleted?: boolean;
  characterLevelUp?: boolean;
  newLevel?: number;
  priorLevel?: number;
  identityMilestone?: string;
}

const REWARD_CHECKS: Array<{
  type: Prompt7RewardType;
  level: string;
  title: string;
  check: (s: ExecutionStats) => boolean;
}> = [
  {
    type: "CONSISTENCY_STREAK",
    level: "NOTABLE",
    title: "Execution Streak: 7 Days",
    check: (s) => (s.consecutiveExecutionDays ?? 0) >= 7,
  },
  {
    type: "CONDITION_UPGRADE",
    level: "NOTABLE",
    title: "Execution Condition Elevated",
    check: (s) => Boolean(s.conditionTransitionedUp),
  },
  {
    type: "FIRST_POWER",
    level: "MAJOR",
    title: "Power State Reached",
    check: (s) => Boolean(s.firstTimeReachingPower),
  },
  {
    type: "PHASE_COMPLETE",
    level: "MAJOR",
    title: "Phase Execution Complete",
    check: (s) => Boolean(s.phaseJustCompleted),
  },
  {
    type: "COMEBACK",
    level: "NOTABLE",
    title: "Execution Continuity Restored",
    check: (s) => Boolean(s.recoveredFromDanger),
  },
  {
    type: "BLUEPRINT_COMPLETE",
    level: "LEGENDARY",
    title: "Blueprint Execution Complete",
    check: (s) => Boolean(s.blueprintJustCompleted),
  },
  {
    type: "CHARACTER_LEVEL_UP",
    level: "NOTABLE",
    title: "Character Progression Elevated",
    check: (s) => Boolean(s.characterLevelUp),
  },
];

async function draftRewardMessage(
  userId: string,
  rewardType: string,
  evidenceSummary: string,
  blueprintId?: string,
): Promise<{ title: string; message: string }> {
  const result = await routeTrigger({
    userId,
    blueprintId,
    triggerType: "BEHAVIORAL_ANALYSIS",
    payload: { rewardType, evidenceSummary },
    worldStateVersion: 0,
    currentCondition: "stability",
    priority: "MEDIUM",
  }).catch(() => null);

  const data = (result?.contextPacket as { data?: Record<string, unknown> })?.data ?? {};
  let title = String(data.title ?? "").slice(0, 60);
  let message = applyExecutionLanguage(String(data.message ?? data.evidenceSummary ?? "").slice(0, 200));

  if (!title || FORBIDDEN_REWARD.test(message)) {
    title = applyExecutionLanguage(
      rewardType.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    );
    message = applyExecutionLanguage("Execution continuity maintained — milestone reached.");
  }

  return { title, message };
}

export async function checkAndGenerateRewards(
  userId: string,
  stats: ExecutionStats,
  blueprintId?: string,
) {
  const created: typeof rewardEvents.$inferSelect[] = [];

  for (const rule of REWARD_CHECKS) {
    if (!rule.check(stats)) continue;

    const idempotencyKey = `p7:${userId}:${rule.type}:${new Date().toISOString().slice(0, 10)}`;
    const [existing] = await db
      .select({ id: rewardEvents.id })
      .from(rewardEvents)
      .where(eq(rewardEvents.idempotency_key, idempotencyKey))
      .limit(1);
    if (existing) continue;

    const evidenceSummary =
      rule.type === "CHARACTER_LEVEL_UP"
        ? `Character level ${stats.priorLevel} → ${stats.newLevel}`
        : rule.title;

    const { title, message } = await draftRewardMessage(
      userId,
      rule.type,
      evidenceSummary,
      blueprintId,
    );

    const [row] = await db
      .insert(rewardEvents)
      .values({
        user_id: userId,
        blueprint_id: blueprintId,
        idempotency_key: idempotencyKey,
        reward_type: rule.type,
        title,
        description: message,
        message,
        evidence_summary: evidenceSummary,
        reward_level: rule.level,
        seen: false,
        delivered: false,
      })
      .returning();

    if (row) created.push(row);

    if (rule.type === "CONDITION_UPGRADE" && stats.identityMilestone) {
      const [profile] = await db
        .select()
        .from(identityProfiles)
        .where(eq(identityProfiles.user_id, userId))
        .limit(1);
      const milestones = Array.isArray(profile?.milestones_reached)
        ? (profile!.milestones_reached as string[])
        : [];
      if (!milestones.includes(stats.identityMilestone)) {
        await db
          .update(identityProfiles)
          .set({
            milestones_reached: [...milestones, stats.identityMilestone],
            last_milestone_at: new Date(),
          })
          .where(eq(identityProfiles.user_id, userId));
      }
    }

    await writeMemory({
      userId,
      blueprintId,
      memoryType: "EXECUTION_PATTERN",
      scope: "USER",
      content: `${title}: ${message}`,
      sourceType: "reward_system",
      confidence: "MEDIUM",
    }).catch(() => null);
  }

  return created;
}

export function sanitizeRewardMessages(messages: string[]): string[] {
  return messages.map((m) =>
    FORBIDDEN_REWARD.test(m)
      ? applyExecutionLanguage("Execution continuity maintained.")
      : applyExecutionLanguage(m),
  );
}
