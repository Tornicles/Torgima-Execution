/**
 * Prompt 7 §2 — Psychology Agent (full Phase 1 activation).
 */
import { db, feedback, identityProfiles, characterProgression, orders } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { routeTrigger } from "../TriggerRouter.js";
import { writeMemory } from "../MemoryService.js";
import { checkAndGenerateRewards } from "../../engines/reward/RewardSystemEngine.js";
import { getCharacterProgression } from "../../engines/character/CharacterProgressionEngine.js";

export interface IdentityAnalysisResult {
  identityStage: string;
  confidenceDelta: number;
  purposeAlignment: number;
  keyInsight: string;
  milestoneProximity: boolean;
}

export interface MotivationAssessment {
  motivationLevel: number;
  meaningAlignment: number;
  requiresMeaningReconnect: boolean;
  recommendedTaskType: string;
}

export async function analyzeIdentityTrajectory(
  userId: string,
  recentFeedback: Array<{ reflection?: string | null; completion_status?: string | null }>,
  character?: typeof characterProgression.$inferSelect | null,
): Promise<IdentityAnalysisResult> {
  const char = character ?? (await getCharacterProgression(userId));
  const completed = recentFeedback.filter((f) => f.completion_status === "completed").length;
  const rate = recentFeedback.length > 0 ? completed / recentFeedback.length : 0;

  const result = await routeTrigger({
    userId,
    triggerType: "BEHAVIORAL_ANALYSIS",
    payload: {
      recentReflections: recentFeedback.map((f) => f.reflection).filter(Boolean).slice(0, 5),
      completionRate: rate,
      characterLevel: char?.character_level ?? 1,
    },
    worldStateVersion: 0,
    currentCondition: "stability",
    priority: "MEDIUM",
  }).catch(() => null);

  const data = (result?.contextPacket as { data?: Record<string, unknown> })?.data ?? {};

  const identityStage = String(data.identityStage ?? (rate >= 0.6 ? "DEVELOPING" : "FORMING"));
  const confidenceDelta = Number(data.confidenceDelta ?? (rate >= 0.5 ? 0.05 : -0.02));
  const purposeAlignment = Number(data.purposeAlignment ?? Math.min(1, rate + (char?.consistency ?? 0) * 0.3));
  const keyInsight = String(
    data.keyInsight ?? "Execution evidence is shaping your operational identity trajectory.",
  );

  const [existing] = await db
    .select()
    .from(identityProfiles)
    .where(eq(identityProfiles.user_id, userId))
    .limit(1);

  const confidence = Math.min(1, Math.max(0, (existing?.confidence_score ?? 0.5) + confidenceDelta));

  if (existing) {
    await db
      .update(identityProfiles)
      .set({
        identity_stage: identityStage,
        confidence_score: confidence,
        purpose_alignment: purposeAlignment,
        confidence_trend: confidenceDelta >= 0 ? "RISING" : confidenceDelta < -0.05 ? "DECLINING" : "STABLE",
      })
      .where(eq(identityProfiles.user_id, userId));
  } else {
    await db.insert(identityProfiles).values({
      user_id: userId,
      identity_stage: identityStage,
      confidence_score: confidence,
      purpose_alignment: purposeAlignment,
    });
  }

  await writeMemory({
    userId,
    memoryType: "EXECUTION_PATTERN",
    scope: "USER",
    content: keyInsight,
    sourceType: "psychology_agent",
    confidence: "MEDIUM",
  }).catch(() => null);

  return {
    identityStage,
    confidenceDelta,
    purposeAlignment,
    keyInsight,
    milestoneProximity: purposeAlignment >= 0.7,
  };
}

export async function assessMotivationState(
  userId: string,
  signalRecord?: { completionRate?: number; scoreAverage?: number },
  recentFeedback: Array<{ reflection?: string | null }> = [],
): Promise<MotivationAssessment> {
  const [profile] = await db
    .select()
    .from(identityProfiles)
    .where(eq(identityProfiles.user_id, userId))
    .limit(1);

  const meaningAlignment = profile?.purpose_alignment ?? 0.5;
  const completion = signalRecord?.completionRate ?? 0.5;
  const motivationLevel = Math.min(1, meaningAlignment * 0.6 + completion * 0.4);
  const requiresMeaningReconnect = meaningAlignment < 0.35;

  return {
    motivationLevel,
    meaningAlignment,
    requiresMeaningReconnect,
    recommendedTaskType: requiresMeaningReconnect ? "meaning_reconnect" : "standard",
  };
}

export async function detectIdentityMilestone(
  userId: string,
  context: { conditionTransition?: string; priorCondition?: string },
) {
  if (context.conditionTransition === "stability" && context.priorCondition === "urgency") {
    await checkAndGenerateRewards(
      userId,
      { conditionTransitionedUp: true, identityMilestone: "REACHED_STABILITY" },
    );
    return { code: "REACHED_STABILITY" as const };
  }
  if (context.conditionTransition === "power") {
    await checkAndGenerateRewards(userId, { firstTimeReachingPower: true });
    return { code: "FIRST_POWER" as const };
  }
  return null;
}

export async function detectResistance(userId: string) {
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await db
    .select({ task_type: orders.task_type, completion_status: feedback.completion_status })
    .from(feedback)
    .innerJoin(orders, eq(feedback.order_id, orders.id))
    .where(and(eq(feedback.user_id, userId), gte(feedback.created_at, since)));

  const skipped = rows.filter((r) => r.completion_status === "skipped");
  const byType = new Map<string, number>();
  for (const s of skipped) {
    const t = (s.task_type as string) ?? "unknown";
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  const top = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 3) return null;

  return {
    resistanceType: "AVOIDANCE_SIGNATURE",
    description: `Repeated avoidance of ${top[0]} Orders.`,
    severity: top[1] >= 5 ? "HIGH" : "MEDIUM",
    breakthroughHint: `Start with a smaller ${top[0]} Order tied to Blueprint purpose.`,
  };
}

export async function runIdentityUpdateFromRecent(userId: string, days = 7) {
  const since = new Date(Date.now() - days * 86400000);
  const recent = await db
    .select({ reflection: feedback.reflection, completion_status: feedback.completion_status })
    .from(feedback)
    .where(and(eq(feedback.user_id, userId), gte(feedback.created_at, since)))
    .orderBy(desc(feedback.created_at))
    .limit(20);

  const character = await getCharacterProgression(userId);
  return analyzeIdentityTrajectory(userId, recent, character);
}
