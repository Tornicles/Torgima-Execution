/**
 * PROMPT 5 — XP, levels, streaks, achievements, avatar.
 */
import {
  db,
  userGamificationProfile,
  xpLedger,
  userLevels,
  userStreaks,
  achievements,
  userAchievements,
  avatarTemplates,
  userAvatar,
  rewards,
  userRewards,
  levelDefinitions,
  users,
} from "@workspace/db";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { routeAndSendNotification } from "../notifications/NotificationDeliveryEngine.js";
import { logger } from "../../lib/logger.js";

export const XP_SOURCES = [
  "order-completion",
  "principle-application",
  "content-published",
  "academy-course",
  "streak-bonus",
  "milestone-reached",
  "achievement-unlocked",
] as const;

export type XpSource = (typeof XP_SOURCES)[number];

export interface XpEventInput {
  userId: string;
  eventType: string;
  sourceId?: string;
  eventData?: Record<string, unknown>;
  skipStreakUpdate?: boolean;
  skipAchievementCheck?: boolean;
}

export function calculateLevelFromXp(totalXP: number): number {
  let level = 1;
  let cumulativeXP = 0;
  let xpForLevel = 100;
  while (cumulativeXP + xpForLevel <= totalXP) {
    cumulativeXP += xpForLevel;
    level++;
    xpForLevel += 50;
  }
  return level;
}

export function xpProgressForLevel(totalXP: number, level: number): {
  xpIntoLevel: number;
  xpToNextLevel: number;
} {
  let cumulative = 0;
  let xpForLevel = 100;
  for (let l = 1; l < level; l++) {
    cumulative += xpForLevel;
    xpForLevel += 50;
  }
  const xpIntoLevel = totalXP - cumulative;
  const xpToNextLevel = Math.max(0, xpForLevel - xpIntoLevel);
  return { xpIntoLevel, xpToNextLevel };
}

export function streakMultiplier(currentCount: number): number {
  if (currentCount >= 30) return 1.3;
  if (currentCount >= 7) return 1.15;
  return 1;
}

export function getStreakTypeForEvent(eventType: string): string {
  switch (eventType) {
    case "order-completion":
      return "execution";
    case "principle-application":
      return "principles";
    case "content-published":
      return "content";
    default:
      return "execution";
  }
}

export function calculateXPForEvent(input: XpEventInput): {
  xpAmount: number;
  xpSource: string;
  multiplierApplied: number;
} {
  const data = input.eventData ?? {};
  let baseXP = 0;
  let multiplier = 1;

  switch (input.eventType) {
    case "order-completion": {
      const difficulty = Number(data.difficulty ?? 3);
      baseXP = difficulty >= 5 ? 75 : difficulty <= 1 ? 25 : 50;
      break;
    }
    case "principle-application":
      baseXP = data.hasProof ? 40 : 30;
      break;
    case "content-published":
      baseXP = 40 + Number(data.platformCount ?? 0) * 5;
      break;
    case "academy-course":
    case "academy-course-completed":
      baseXP = Number(data.courseDifficulty ?? 2) * 20;
      break;
    case "milestone-reached":
      baseXP = 100;
      break;
    case "achievement-unlocked":
      baseXP = Number(data.xpReward ?? 25);
      break;
    default:
      baseXP = 10;
  }

  if (!["milestone-reached", "achievement-unlocked", "streak-bonus"].includes(input.eventType)) {
    const streakType = getStreakTypeForEvent(input.eventType);
    multiplier = streakMultiplier(Number(data.streakCount ?? data.currentStreak ?? 0));
    if (!data.streakCount && !data.currentStreak) {
      multiplier = 1;
    }
  }

  return {
    xpAmount: Math.floor(baseXP * multiplier),
    xpSource: input.eventType,
    multiplierApplied: multiplier,
  };
}

export async function getOrCreateProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(userGamificationProfile)
    .where(eq(userGamificationProfile.user_id, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(userGamificationProfile)
    .values({
      user_id: userId,
      current_level: 1,
      total_xp: 0,
      xp_to_next_level: 100,
    })
    .returning();
  return created!;
}

export async function updateStreakForEvent(userId: string, eventType: string) {
  const streakType = getStreakTypeForEvent(eventType);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [row] = await db
    .select()
    .from(userStreaks)
    .where(and(eq(userStreaks.user_id, userId), eq(userStreaks.streak_type, streakType)))
    .limit(1);

  if (!row) {
    await db.insert(userStreaks).values({
      user_id: userId,
      streak_type: streakType,
      current_count: 1,
      best_count: 1,
      last_activity_date: today,
    });
    return { streakType, currentCount: 1 };
  }

  if (row.last_activity_date === today) {
    return { streakType, currentCount: row.current_count };
  }

  let current = 1;
  let best = row.best_count;
  if (row.last_activity_date === yesterdayStr) {
    current = row.current_count + 1;
    if (current > best) best = current;
  } else if (row.current_count > best) {
    best = row.current_count;
  }

  await db
    .update(userStreaks)
    .set({
      current_count: current,
      best_count: best,
      last_activity_date: today,
      updated_at: new Date(),
    })
    .where(eq(userStreaks.id, row.id));

  return { streakType, currentCount: current };
}

async function getStreakCount(userId: string, eventType: string): Promise<number> {
  const streakType = getStreakTypeForEvent(eventType);
  const [row] = await db
    .select()
    .from(userStreaks)
    .where(and(eq(userStreaks.user_id, userId), eq(userStreaks.streak_type, streakType)))
    .limit(1);
  return row?.current_count ?? 0;
}

export async function unlockRewardsForLevel(userId: string, level: number, totalXP: number) {
  const all = await db.select().from(rewards);
  const earned = await db
    .select({ reward_id: userRewards.reward_id })
    .from(userRewards)
    .where(eq(userRewards.user_id, userId));
  const have = new Set(earned.map((e) => e.reward_id));

  for (const reward of all) {
    if (have.has(reward.id)) continue;
    const req = reward.unlock_requirement ?? "";
    let unlock = false;
    if (req.startsWith("level:")) {
      unlock = level >= Number(req.split(":")[1] ?? 0);
    } else if (req.startsWith("xp:")) {
      unlock = totalXP >= Number(req.split(":")[1] ?? 0);
    }

    if (!unlock) continue;

    await db.insert(userRewards).values({
      user_id: userId,
      reward_id: reward.id,
    });

    await db
      .update(userGamificationProfile)
      .set({
        total_rewards_earned: sql`${userGamificationProfile.total_rewards_earned} + 1`,
        updated_at: new Date(),
      })
      .where(eq(userGamificationProfile.user_id, userId));
  }
}

export async function listUserRewards(userId: string) {
  return db
    .select({
      id: userRewards.id,
      earnedAt: userRewards.earned_at,
      rewardId: rewards.reward_id,
      title: rewards.title,
      description: rewards.description,
      rewardType: rewards.reward_type,
    })
    .from(userRewards)
    .innerJoin(rewards, eq(userRewards.reward_id, rewards.id))
    .where(eq(userRewards.user_id, userId))
    .orderBy(desc(userRewards.earned_at));
}

export async function awardXP(
  input: XpEventInput,
): Promise<{
  xpAwarded: number;
  leveledUp: boolean;
  newLevel?: number;
  achievementsUnlocked: string[];
}> {
  let streakCount = 0;
  if (!input.skipStreakUpdate && getStreakTypeForEvent(input.eventType)) {
    const s = await updateStreakForEvent(input.userId, input.eventType);
    streakCount = s.currentCount;
  } else if (!["milestone-reached", "achievement-unlocked", "streak-bonus"].includes(input.eventType)) {
    streakCount = await getStreakCount(input.userId, input.eventType);
  }

  const calc = calculateXPForEvent({
    ...input,
    eventData: { ...input.eventData, currentStreak: streakCount },
  });

  if (calc.xpAmount <= 0) {
    return { xpAwarded: 0, leveledUp: false, achievementsUnlocked: [] };
  }

  await db.insert(xpLedger).values({
    user_id: input.userId,
    xp_amount: calc.xpAmount,
    xp_source: calc.xpSource,
    source_id: input.sourceId,
    multiplier_applied: calc.multiplierApplied,
    earned_at: new Date(),
  });

  const profile = await getOrCreateProfile(input.userId);
  const newTotal = profile.total_xp + calc.xpAmount;
  const newLevel = calculateLevelFromXp(newTotal);
  const { xpToNextLevel } = xpProgressForLevel(newTotal, newLevel);
  const leveledUp = newLevel > profile.current_level;
  const achievementsUnlocked: string[] = [];

  await db
    .update(userGamificationProfile)
    .set({
      total_xp: newTotal,
      current_level: newLevel,
      xp_to_next_level: xpToNextLevel,
      updated_at: new Date(),
    })
    .where(eq(userGamificationProfile.user_id, input.userId));

  if (leveledUp) {
    for (let lv = profile.current_level + 1; lv <= newLevel; lv++) {
      await db
        .insert(userLevels)
        .values({
          user_id: input.userId,
          level_number: lv,
          xp_required_total: newTotal,
          milestone_description: `Reached level ${lv}`,
        })
        .onConflictDoNothing();

      const [def] = await db
        .select()
        .from(levelDefinitions)
        .where(eq(levelDefinitions.level, lv))
        .limit(1);

      if (def?.avatar_evolution_unlocked) {
        logger.info({ userId: input.userId, level: lv }, "[Gamification] Avatar evolution unlocked");
      }

      await unlockRewardsForLevel(input.userId, lv, newTotal);

      try {
        await routeAndSendNotification({
          userId: input.userId,
          notificationType: "engagement-milestone",
          title: `Level ${lv}`,
          body: def?.milestone_title ?? `You reached level ${lv}`,
          priority: 2,
          channelsToSend: ["in-app", "push"],
        });
      } catch {
        /* non-fatal */
      }
    }

    if (input.eventType !== "milestone-reached") {
      await awardXP({
        userId: input.userId,
        eventType: "milestone-reached",
        sourceId: `level-${newLevel}`,
        skipStreakUpdate: true,
        skipAchievementCheck: true,
      });
    }
  }

  if (!input.skipAchievementCheck) {
    const unlocked = await checkAndUnlockAchievements(input.userId);
    achievementsUnlocked.push(...unlocked);
  }

  return {
    xpAwarded: calc.xpAmount,
    leveledUp,
    newLevel: leveledUp ? newLevel : undefined,
    achievementsUnlocked,
  };
}

type TriggerCondition = {
  type?: string;
  value?: number;
  streakType?: string;
};

export async function checkAndUnlockAchievements(userId: string): Promise<string[]> {
  const profile = await getOrCreateProfile(userId);
  const streakRows = await db.select().from(userStreaks).where(eq(userStreaks.user_id, userId));
  const allAch = await db.select().from(achievements);
  const unlockedIds: string[] = [];

  const existing = await db
    .select({ achievement_id: userAchievements.achievement_id })
    .from(userAchievements)
    .where(eq(userAchievements.user_id, userId));
  const have = new Set(existing.map((e) => e.achievement_id));

  for (const ach of allAch) {
    if (have.has(ach.id)) continue;
    const cond = (ach.trigger_condition ?? {}) as TriggerCondition;
    let should = false;

    if (cond.type === "level-reached" || cond.type === "level") {
      should = profile.current_level >= Number(cond.value ?? 0);
    } else if (cond.type === "streak-milestone" || cond.type === "streak") {
      const s = streakRows.find((r) => r.streak_type === cond.streakType);
      should = (s?.current_count ?? 0) >= Number(cond.value ?? 0);
    } else if (cond.type === "xp-milestone") {
      should = profile.total_xp >= Number(cond.value ?? 0);
    }

    if (!should) continue;

    await db.insert(userAchievements).values({
      user_id: userId,
      achievement_id: ach.id,
    });

    await db
      .update(userGamificationProfile)
      .set({
        total_achievements: sql`${userGamificationProfile.total_achievements} + 1`,
        updated_at: new Date(),
      })
      .where(eq(userGamificationProfile.user_id, userId));

    unlockedIds.push(ach.achievement_id);

    if (ach.xp_reward > 0) {
      await awardXP({
        userId,
        eventType: "achievement-unlocked",
        sourceId: ach.id,
        eventData: { xpReward: ach.xp_reward },
        skipStreakUpdate: true,
        skipAchievementCheck: true,
      });
    }
  }

  return unlockedIds;
}

export async function getGamificationProfile(userId: string) {
  const profile = await getOrCreateProfile(userId);
  const [avatar] = await db.select().from(userAvatar).where(eq(userAvatar.user_id, userId)).limit(1);
  const streaks = await db.select().from(userStreaks).where(eq(userStreaks.user_id, userId));
  const { xpIntoLevel, xpToNextLevel } = xpProgressForLevel(profile.total_xp, profile.current_level);

  return {
    userId: profile.user_id,
    currentLevel: profile.current_level,
    totalXP: profile.total_xp,
    xpIntoLevel,
    xpToNextLevel,
    totalAchievements: profile.total_achievements,
    totalRewardsEarned: profile.total_rewards_earned,
    avatarCustomization: profile.avatar_customization,
    avatar: avatar ?? null,
    streaks,
  };
}

export async function listXpLedger(userId: string, limit = 50, offset = 0) {
  return db
    .select()
    .from(xpLedger)
    .where(eq(xpLedger.user_id, userId))
    .orderBy(desc(xpLedger.earned_at))
    .limit(limit)
    .offset(offset);
}

export async function listUserAchievements(userId: string) {
  return db
    .select({
      id: userAchievements.id,
      unlockedAt: userAchievements.unlocked_at,
      achievementId: achievements.achievement_id,
      title: achievements.title,
      description: achievements.description,
      iconUrl: achievements.icon_url,
      rarity: achievements.rarity,
      xpReward: achievements.xp_reward,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievement_id, achievements.id))
    .where(eq(userAchievements.user_id, userId))
    .orderBy(desc(userAchievements.unlocked_at));
}

export async function listAvatarTemplatesForLevel(level: number) {
  return db
    .select()
    .from(avatarTemplates)
    .where(sql`${avatarTemplates.evolution_level} <= ${level}`)
    .orderBy(avatarTemplates.evolution_level);
}

export async function customizeAvatar(
  userId: string,
  params: {
    templateId: string;
    color: string;
    accessories?: string[];
    pose?: string;
  },
) {
  const profile = await getOrCreateProfile(userId);
  const [template] = await db
    .select()
    .from(avatarTemplates)
    .where(eq(avatarTemplates.id, params.templateId))
    .limit(1);
  if (!template) throw new Error("Avatar template not found");
  if (template.evolution_level > profile.current_level) {
    throw new Error("Avatar evolution not yet unlocked");
  }

  const opts = (template.customization_options ?? {}) as {
    colors?: string[];
    accessories?: string[];
    poses?: string[];
  };
  if (opts.colors?.length && !opts.colors.includes(params.color)) {
    throw new Error("Invalid color for this avatar");
  }

  const [row] = await db
    .insert(userAvatar)
    .values({
      user_id: userId,
      current_avatar_template_id: params.templateId,
      color: params.color,
      accessories: params.accessories ?? [],
      pose: params.pose ?? "standing",
      customized_at: new Date(),
    })
    .onConflictDoUpdate({
      target: userAvatar.user_id,
      set: {
        current_avatar_template_id: params.templateId,
        color: params.color,
        accessories: params.accessories ?? [],
        pose: params.pose ?? "standing",
        customized_at: new Date(),
      },
    })
    .returning();

  await db
    .update(userGamificationProfile)
    .set({
      avatar_customization: {
        color: params.color,
        accessories: params.accessories ?? [],
        pose: params.pose ?? "standing",
      },
      updated_at: new Date(),
    })
    .where(eq(userGamificationProfile.user_id, userId));

  return row;
}

export async function getPersonalLeaderboard(userId: string) {
  const profile = await getOrCreateProfile(userId);
  const [rankRow] = await db
    .select({ higher: count() })
    .from(userGamificationProfile)
    .where(gt(userGamificationProfile.total_xp, profile.total_xp));

  return {
    userId,
    level: profile.current_level,
    totalXP: profile.total_xp,
    totalAchievements: profile.total_achievements,
    approximateRank: Number(rankRow?.higher ?? 0) + 1,
  };
}

export async function getLeaderboard(type: "xp" | "level", limit = 100) {
  const order =
    type === "level"
      ? desc(userGamificationProfile.current_level)
      : desc(userGamificationProfile.total_xp);

  const rows = await db
    .select({
      userId: userGamificationProfile.user_id,
      level: userGamificationProfile.current_level,
      totalXP: userGamificationProfile.total_xp,
      displayName: users.display_name,
    })
    .from(userGamificationProfile)
    .innerJoin(users, eq(users.id, userGamificationProfile.user_id))
    .orderBy(order, desc(userGamificationProfile.total_xp))
    .limit(limit);

  return rows;
}

export async function listAvailableRewards(userId: string) {
  const earned = await db
    .select({ reward_id: userRewards.reward_id })
    .from(userRewards)
    .where(eq(userRewards.user_id, userId));
  const earnedSet = new Set(earned.map((e) => e.reward_id));
  const all = await db.select().from(rewards);
  return all.filter((r) => !earnedSet.has(r.id));
}

/** Hook for orders, principles, academy, content pipelines. */
export async function recordXpEvent(input: XpEventInput) {
  return awardXP(input);
}
