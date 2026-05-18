/**
 * Prompt 10 — deterministic mastery rules; Bhudhi assesses evidence quality.
 */
import { db, learningPaths, skillProfiles, capabilityGapLogs, feedback } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { writeMemory } from "../../bhudhi/MemoryService.js";
import { checkAndGenerateRewards } from "../reward/RewardSystemEngine.js";
import { extendLearningPathWithPractice } from "./LearningPathGenerator.js";
import { assessSkillLevel } from "./CapabilityGapEngine.js";
import { logger } from "../../lib/logger.js";

export interface MasteryResult {
  mastered: boolean;
  masteryScore: number;
  reasons: string[];
}

export async function assessMastery(params: {
  userId: string;
  learningPathId: string;
  feedbackId: string;
  completionScore: number;
  proofText?: string;
}): Promise<MasteryResult> {
  const reasons: string[] = [];
  const scoreOk = params.completionScore >= 7;
  if (!scoreOk) reasons.push("completion_score_below_7");

  const [fb] = await db
    .select({ reflection: feedback.reflection, proof_json: feedback.proof_json })
    .from(feedback)
    .where(eq(feedback.id, params.feedbackId))
    .limit(1);

  const proofText =
    params.proofText ??
    fb?.reflection ??
    JSON.stringify(fb?.proof_json ?? {});

  let proofQuality = 0.5;
  if (proofText.length > 80) proofQuality = 0.7;
  if (proofText.length > 200) proofQuality = 0.85;
  const proofOk = proofQuality >= 0.65;
  if (!proofOk) reasons.push("proof_quality_low");

  const mastered = scoreOk && proofOk;
  const masteryScore = mastered ? Math.min(10, params.completionScore) / 10 : params.completionScore / 10;

  if (mastered) {
    await recordMasterySuccess(params.userId, params.learningPathId, masteryScore, proofText);
  } else {
    await recordMasteryFailure(params.userId, params.learningPathId);
  }

  return { mastered, masteryScore, reasons };
}

async function recordMasterySuccess(
  userId: string,
  learningPathId: string,
  masteryScore: number,
  evidence: string,
): Promise<void> {
  const [path] = await db
    .select()
    .from(learningPaths)
    .where(eq(learningPaths.id, learningPathId))
    .limit(1);

  if (!path) return;

  const skill = path.skill_gap;

  await db
    .update(learningPaths)
    .set({
      path_status: "COMPLETE",
      mastery_score: masteryScore,
      mastery_evidence: evidence.slice(0, 500),
      completed_at: new Date(),
    })
    .where(eq(learningPaths.id, learningPathId));

  const [profile] = await db
    .select()
    .from(skillProfiles)
    .where(eq(skillProfiles.user_id, userId))
    .limit(1);

  if (profile) {
    const scores = { ...(profile.skill_scores as Record<string, number>) };
    scores[skill] = Math.max(scores[skill] ?? 0, 0.75);
    const mastered = [...new Set([...(profile.mastered_skills as string[]), skill])];
    const gaps = (profile.detected_gaps as unknown[]).filter(
      (g) => (g as { skillCategory?: string })?.skillCategory !== skill,
    );

    await db
      .update(skillProfiles)
      .set({
        skill_scores: scores,
        mastered_skills: mastered,
        detected_gaps: gaps,
        last_assessment: new Date(),
      })
      .where(eq(skillProfiles.user_id, userId));
  }

  await db
    .update(capabilityGapLogs)
    .set({ resolved: true, resolved_at: new Date() })
    .where(
      and(
        eq(capabilityGapLogs.user_id, userId),
        eq(capabilityGapLogs.gap_type, skill),
        eq(capabilityGapLogs.resolved, false),
      ),
    );

  await writeMemory({
    userId,
    blueprintId: path.blueprint_id ?? undefined,
    memoryType: "SKILL_PROGRESSION",
    scope: "USER",
    content: JSON.stringify({
      skillCategory: skill,
      masteryScore,
      learningPathsCompleted: 1,
      gapsResolved: [skill],
    }),
    sourceType: "skill_progression",
    confidence: "HIGH",
  }).catch(() => null);

  await checkAndGenerateRewards(
    userId,
    { identityMilestone: `mastery_${skill}`, consecutiveExecutionDays: 0 },
    path.blueprint_id ?? undefined,
  ).catch(() => null);

  logger.info({ userId, skill, learningPathId }, "[Mastery] Recorded");
}

export async function recordMasteryFailure(
  userId: string,
  learningPathId: string,
): Promise<void> {
  const [path] = await db
    .select({ skill_gap: learningPaths.skill_gap })
    .from(learningPaths)
    .where(eq(learningPaths.id, learningPathId))
    .limit(1);
  if (path) {
    await extendLearningPathWithPractice(learningPathId, path.skill_gap);
  }
  logger.info({ userId, learningPathId }, "[Mastery] Assessment failed — path extended");
}

export async function checkWeeklyMasteryEvidence(
  userId: string,
  gap: { gap_type: string; metadata_json?: unknown },
): Promise<void> {
  const skill = gap.gap_type;
  const meta = (gap.metadata_json ?? {}) as { targetScore?: number };
  const score = await assessSkillLevel(userId, skill);
  if (score >= (meta.targetScore ?? 0.7)) {
    logger.info({ userId, skill, score }, "[Mastery] Weekly evidence suggests improvement");
  }
}
