/**
 * DOC25 Task 3 — aggregate behavioral evidence for friction classification.
 */

import {
  db,
  orders,
  feedback,
  behaviorEvents,
  cognitiveLoadScores,
  systemHealthLogs,
  failureClassifications,
  inactivityRecords,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { getOpenFlags } from "../outcome/OutcomeValidationEngine.js";
import type { FrictionContext } from "./frictionTypes.js";

export type FrictionEvidence = {
  userId: string;
  blueprintId: string;
  feedbackId?: string;
  orderId?: string;
  reflection: string;
  completionStatus: string;
  score: number | null;
  frictionScore: number | null;
  durationMinutes: number | null;
  timeEstimateMinutes: number | null;
  submittedHoursAfterStart: number | null;
  difficulty: string | null;
  proofRequired: boolean;
  proofDescription: string | null;
  proofProvided: boolean;
  inactivityType: string | null;
  capabilityFailureClassified: boolean;
  dependencyBlocked: boolean;
  cognitiveLoadLevel: string | null;
  cognitiveLoadRecent: boolean;
  reflectionToneNegative: boolean;
  stateIntegrityIssueRecent: boolean;
  reflectionMentionsSystem: boolean;
  outcomeMovementScore: number;
  falseProgressSignal: number;
  taskAccepted: boolean;
  consecutiveClarityCount: number;
  adaptationCycleCount: Record<string, number>;
};

const DIFFICULTY_RANK: Record<string, number> = {
  very_easy: 1,
  easy: 2,
  moderate: 3,
  hard: 4,
  very_hard: 5,
};

function reflectionMentionsUnclear(reflection: string): boolean {
  const lower = reflection.toLowerCase();
  return /\b(confused|unclear|don't know|didn't know|not sure what|what to deliver|what was expected)\b/.test(
    lower,
  );
}

function reflectionMentionsSystem(reflection: string): boolean {
  const lower = reflection.toLowerCase();
  return /\b(app|system|error|bug|crash|broken|glitch|platform)\b/.test(lower);
}

function reflectionToneNegative(reflection: string): boolean {
  const lower = reflection.toLowerCase();
  return /\b(frustrated|hopeless|give up|can't|hate|overwhelmed|stuck|demotivated|discouraged)\b/.test(
    lower,
  );
}

function proofProvidedFromJson(proofJson: unknown): boolean {
  if (!proofJson || typeof proofJson !== "object") return false;
  const obj = proofJson as Record<string, unknown>;
  return Boolean(obj.url ?? obj.text ?? obj.file_id ?? obj.submitted ?? obj.proof);
}

function isHardOrAbove(difficulty: string | null | undefined): boolean {
  const rank = DIFFICULTY_RANK[difficulty ?? "moderate"] ?? 3;
  return rank >= DIFFICULTY_RANK.hard!;
}

export function buildFrictionEvidenceFromParts(
  parts: Partial<FrictionEvidence> & Pick<FrictionEvidence, "userId" | "blueprintId">,
): FrictionEvidence {
  const reflection = parts.reflection ?? "";
  return {
    userId: parts.userId,
    blueprintId: parts.blueprintId,
    feedbackId: parts.feedbackId,
    orderId: parts.orderId,
    reflection,
    completionStatus: parts.completionStatus ?? "failed",
    score: parts.score ?? null,
    frictionScore: parts.frictionScore ?? null,
    durationMinutes: parts.durationMinutes ?? null,
    timeEstimateMinutes: parts.timeEstimateMinutes ?? null,
    submittedHoursAfterStart: parts.submittedHoursAfterStart ?? null,
    difficulty: parts.difficulty ?? null,
    proofRequired: parts.proofRequired ?? false,
    proofDescription: parts.proofDescription ?? null,
    proofProvided: parts.proofProvided ?? false,
    inactivityType: parts.inactivityType ?? null,
    capabilityFailureClassified: parts.capabilityFailureClassified ?? false,
    dependencyBlocked: parts.dependencyBlocked ?? false,
    cognitiveLoadLevel: parts.cognitiveLoadLevel ?? null,
    cognitiveLoadRecent: parts.cognitiveLoadRecent ?? false,
    reflectionToneNegative: parts.reflectionToneNegative ?? reflectionToneNegative(reflection),
    stateIntegrityIssueRecent: parts.stateIntegrityIssueRecent ?? false,
    reflectionMentionsSystem:
      parts.reflectionMentionsSystem ?? reflectionMentionsSystem(reflection),
    outcomeMovementScore: parts.outcomeMovementScore ?? 50,
    falseProgressSignal: parts.falseProgressSignal ?? 0,
    taskAccepted: parts.taskAccepted ?? false,
    consecutiveClarityCount: parts.consecutiveClarityCount ?? 0,
    adaptationCycleCount: parts.adaptationCycleCount ?? {},
  };
}

export async function loadFrictionEvidence(context: FrictionContext): Promise<FrictionEvidence | null> {
  if (!context.feedbackId) return null;

  const [fb] = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, context.feedbackId))
    .limit(1);

  if (!fb) return null;

  const orderId = context.orderId ?? fb.order_id ?? undefined;
  const [order] = orderId
    ? await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    : [undefined];

  const since7d = new Date(Date.now() - 7 * 86400000);
  const since30m = new Date(Date.now() - 30 * 60 * 1000);
  const since2h = new Date(Date.now() - 2 * 3600000);
  const since14d = new Date(Date.now() - 14 * 86400000);

  const [
    clarityEvents,
    adaptationEvents,
    cogRows,
    integrityRows,
    capabilityRows,
    inactivityRows,
    openFlags,
  ] = await Promise.all([
    db
      .select({ data_json: behaviorEvents.data_json })
      .from(behaviorEvents)
      .where(
        and(
          eq(behaviorEvents.user_id, context.userId),
          eq(behaviorEvents.blueprint_id, context.blueprintId),
          gte(behaviorEvents.detected_at, since7d),
        ),
      )
      .orderBy(desc(behaviorEvents.detected_at))
      .limit(20),
    db
      .select({ data_json: behaviorEvents.data_json, event_type: behaviorEvents.event_type })
      .from(behaviorEvents)
      .where(
        and(
          eq(behaviorEvents.user_id, context.userId),
          eq(behaviorEvents.blueprint_id, context.blueprintId),
          gte(behaviorEvents.detected_at, since14d),
        ),
      )
      .orderBy(desc(behaviorEvents.detected_at))
      .limit(50),
    db
      .select({
        load_score: cognitiveLoadScores.load_score,
        load_category: cognitiveLoadScores.load_category,
        created_at: cognitiveLoadScores.created_at,
      })
      .from(cognitiveLoadScores)
      .where(
        and(
          eq(cognitiveLoadScores.user_id, context.userId),
          eq(cognitiveLoadScores.blueprint_id, context.blueprintId),
          gte(cognitiveLoadScores.created_at, since30m),
        ),
      )
      .orderBy(desc(cognitiveLoadScores.created_at))
      .limit(1),
    db
      .select({ id: systemHealthLogs.id })
      .from(systemHealthLogs)
      .where(
        and(
          eq(systemHealthLogs.blueprint_id, context.blueprintId),
          gte(systemHealthLogs.created_at, since2h),
        ),
      )
      .limit(1),
    orderId
      ? db
          .select({ primary_candidate: failureClassifications.primary_candidate })
          .from(failureClassifications)
          .where(
            and(
              eq(failureClassifications.order_id, orderId),
              eq(failureClassifications.primary_candidate, "CAPABILITY_FAILURE"),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
    db
      .select({ inactivity_type: inactivityRecords.inactivity_type })
      .from(inactivityRecords)
      .where(
        and(
          eq(inactivityRecords.user_id, context.userId),
          eq(inactivityRecords.blueprint_id, context.blueprintId),
        ),
      )
      .orderBy(desc(inactivityRecords.created_at))
      .limit(1),
    getOpenFlags(context.blueprintId).catch(() => []),
  ]);

  const reflection = typeof fb.reflection === "string" ? fb.reflection : "";

  const blocker = (fb.blocker_json ?? {}) as Record<string, unknown>;
  const completionStatus = (fb.completion_status ?? "failed").toUpperCase();
  const dependencyBlocked =
    completionStatus === "BLOCKED" ||
    blocker.blocker_type === "dependency" ||
    blocker.category === "DEPENDENCY";

  const consecutiveClarity = clarityEvents.filter((row) => {
    const data = row.data_json as { friction_type?: string };
    return data.friction_type === "CLARITY_FRICTION";
  }).length;

  const adaptationCycleCount: Record<string, number> = {};
  for (const row of adaptationEvents) {
    const data = row.data_json as { friction_type?: string; adaptation_event?: string };
    if (row.event_type !== "friction_adaptation_applied") continue;
    const type = data.friction_type;
    if (!type) continue;
    adaptationCycleCount[type] = (adaptationCycleCount[type] ?? 0) + 1;
  }

  const falseProgressFlag = openFlags.find(
    (f) =>
      f.detection_type === "FALSE_PROGRESS" ||
      String(f.detection_type ?? "").toUpperCase().includes("FALSE"),
  );
  const falseProgressSignal = falseProgressFlag?.false_progress_score ?? 0;

  const loadScore = cogRows[0]?.load_score ?? 0;
  const cogLevel =
    loadScore >= 80
      ? "CRITICAL"
      : loadScore >= 60
        ? "HIGH"
        : loadScore >= 35
          ? "MEDIUM"
          : "LOW";
  const cogRecent = Boolean(cogRows[0]?.created_at);

  return buildFrictionEvidenceFromParts({
    userId: context.userId,
    blueprintId: context.blueprintId,
    feedbackId: context.feedbackId,
    orderId: orderId ?? undefined,
    reflection,
    completionStatus,
    score: fb.score ?? null,
    frictionScore: fb.friction_score ?? null,
    durationMinutes: fb.duration_minutes ?? null,
    timeEstimateMinutes: order?.time_estimate_minutes ?? null,
    submittedHoursAfterStart: fb.submitted_hours_after_completion ?? null,
    difficulty: order?.difficulty ?? null,
    proofRequired: Boolean(order?.proof_required),
    proofDescription: order?.proof_description ?? null,
    proofProvided: proofProvidedFromJson(fb.proof_json),
    inactivityType: inactivityRows[0]?.inactivity_type ?? null,
    capabilityFailureClassified: capabilityRows.length > 0,
    dependencyBlocked,
    cognitiveLoadLevel: cogLevel,
    cognitiveLoadRecent: cogRecent && ["HIGH", "CRITICAL"].includes(cogLevel ?? ""),
    reflectionToneNegative: reflectionToneNegative(reflection),
    stateIntegrityIssueRecent: integrityRows.length > 0,
    reflectionMentionsSystem: reflectionMentionsSystem(reflection),
    outcomeMovementScore:
      typeof fb.weighted_score === "number" ? fb.weighted_score : (fb.score ?? 0) * 10,
    falseProgressSignal,
    taskAccepted: completionStatus === "ACCEPTED" || fb.completion_status === "completed",
    consecutiveClarityCount: consecutiveClarity,
    adaptationCycleCount,
  });
}

export { reflectionMentionsUnclear, reflectionMentionsSystem, reflectionToneNegative, isHardOrAbove };
