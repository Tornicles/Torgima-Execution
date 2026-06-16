/**
 * DOC19 Task 1 — eligibility and blocking rules for all 9 reward types.
 */

import {
  db,
  feedback,
  falseProgressFlags,
  inactivityRecords,
  outcomeValidations,
  signalSnapshots,
  orders,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { isVerifiedFeedbackEvidence } from "../identity/TransformationEvidenceCollector.js";
import { isMilestoneRewardEligible, loadMilestoneRecord } from "./MilestoneEngine.js";
import type { RewardIntensity, RewardSourceType, RewardType } from "./rewardTypes.js";

export interface RewardEligibilityResult {
  rewardType: RewardType;
  intensity: RewardIntensity;
}

export interface BlockingResult {
  isBlocked: boolean;
  reason?: string;
}

export function buildRewardIdempotencyKey(
  userId: string,
  sourceType: string,
  sourceId: string,
  rewardType: RewardType,
): string {
  return `${userId}:${sourceType}:${sourceId}:${rewardType}`;
}

async function hasOpenFalseProgress(blueprintId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: falseProgressFlags.id })
    .from(falseProgressFlags)
    .where(and(eq(falseProgressFlags.blueprint_id, blueprintId), eq(falseProgressFlags.resolved, false)))
    .limit(1);
  return Boolean(row);
}

async function hasCriticalFalseProgress(blueprintId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: falseProgressFlags.id })
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, blueprintId),
        eq(falseProgressFlags.resolved, false),
        sql`lower(${falseProgressFlags.severity}) = 'critical'`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function repeatedIdenticalFailure(userId: string, blueprintId: string): Promise<boolean> {
  const since = new Date(Date.now() - 14 * 86400000);
  const rows = await db
    .select({ failure_classification: feedback.failure_classification })
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, userId),
        eq(feedback.blueprint_id, blueprintId),
        gte(feedback.created_at, since),
        eq(feedback.completion_status, "failed"),
      ),
    )
    .orderBy(desc(feedback.created_at))
    .limit(3);

  if (rows.length < 3) return false;
  const first = rows[0]?.failure_classification ?? "";
  return rows.every((r) => (r.failure_classification ?? "") === first && first.length > 0);
}

export async function loadSourceRecord(
  sourceType: RewardSourceType | string,
  sourceId: string,
  userId: string,
) {
  switch (sourceType) {
    case "FEEDBACK": {
      const [row] = await db
        .select()
        .from(feedback)
        .where(and(eq(feedback.id, sourceId), eq(feedback.user_id, userId)))
        .limit(1);
      return row ?? null;
    }
    case "INACTIVITY": {
      const [row] = await db
        .select()
        .from(inactivityRecords)
        .where(and(eq(inactivityRecords.id, sourceId), eq(inactivityRecords.user_id, userId)))
        .limit(1);
      return row ?? null;
    }
    case "OUTCOME": {
      const [row] = await db
        .select()
        .from(outcomeValidations)
        .where(and(eq(outcomeValidations.id, sourceId), eq(outcomeValidations.user_id, userId)))
        .limit(1);
      return row ?? null;
    }
    case "MILESTONE":
      return loadMilestoneRecord(sourceId, userId);
    case "SIGNAL": {
      const [row] = await db
        .select()
        .from(signalSnapshots)
        .where(and(eq(signalSnapshots.id, sourceId), eq(signalSnapshots.blueprint_id, sourceId)))
        .limit(1);
      return row ?? null;
    }
    case "TASK_GENERATION": {
      const [row] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, sourceId), eq(orders.user_id, userId)))
        .limit(1);
      return row ?? null;
    }
    default:
      return { id: sourceId, user_id: userId } as Record<string, unknown>;
  }
}

export async function getEligibleRewardTypes(
  sourceType: RewardSourceType | string,
  source: Record<string, unknown>,
  params: { userId: string; blueprintId?: string },
): Promise<RewardEligibilityResult[]> {
  const results: RewardEligibilityResult[] = [];

  if (sourceType === "FEEDBACK") {
    const fb = source as typeof feedback.$inferSelect;
    if (!isVerifiedFeedbackEvidence(fb)) return results;

    if (fb.completion_status === "completed" || fb.completion_status === "partial") {
      const score = fb.weighted_score ?? fb.score ?? 0;
      if (score >= 6) {
        const intensity: RewardIntensity = score >= 8 ? "HIGH" : "MEDIUM";
        results.push({ rewardType: "COMPLETION", intensity });
      }
    }

    if (fb.completion_status === "failed" || fb.completion_status === "blocked") {
      const reflectionLen = (fb.reflection ?? "").trim().length;
      if (reflectionLen >= 30 && !fb.gaming_flag) {
        if (!(await repeatedIdenticalFailure(params.userId, fb.blueprint_id))) {
          results.push({ rewardType: "HONEST_FAILURE", intensity: "LOW" });
        }
      }
    }

    const since = new Date(Date.now() - 7 * 86400000);
    const recent = await db
      .select({ id: feedback.id, gaming_flag: feedback.gaming_flag, validity: feedback.validity })
      .from(feedback)
      .where(
        and(
          eq(feedback.user_id, params.userId),
          eq(feedback.blueprint_id, fb.blueprint_id),
          gte(feedback.created_at, since),
          eq(feedback.completion_status, "completed"),
        ),
      )
      .orderBy(desc(feedback.created_at))
      .limit(5);

    const verified = recent.filter((r) => r.validity === "valid" && !r.gaming_flag);
    if (verified.length >= 5) {
      results.push({ rewardType: "CONSISTENCY", intensity: "HIGH" });
    }
    return results;
  }

  if (sourceType === "SIGNAL" && params.blueprintId) {
    const [snap] = await db
      .select({ completion_rate: signalSnapshots.completion_rate })
      .from(signalSnapshots)
      .where(
        and(
          eq(signalSnapshots.blueprint_id, params.blueprintId),
          eq(signalSnapshots.is_current, true),
        ),
      )
      .limit(1);

    const rate = Number(snap?.completion_rate ?? 0);
    const since = new Date(Date.now() - 7 * 86400000);
    const recentFb = await db
      .select({ id: feedback.id, validity: feedback.validity, gaming_flag: feedback.gaming_flag })
      .from(feedback)
      .where(
        and(
          eq(feedback.user_id, params.userId),
          eq(feedback.blueprint_id, params.blueprintId),
          gte(feedback.created_at, since),
        ),
      )
      .limit(10);

    const accepted = recentFb.filter((r) => r.validity === "valid" && !r.gaming_flag);
    if (rate >= 0.7 && accepted.length > 0) {
      results.push({ rewardType: "CONSISTENCY", intensity: "MEDIUM" });
    }
    return results;
  }

  if (sourceType === "INACTIVITY") {
    const record = source as typeof inactivityRecords.$inferSelect;
    if (
      record.resolved &&
      (record.response_triggered === "returned_to_execution" ||
        record.response_triggered === "cleared")
    ) {
      results.push({ rewardType: "RECOVERY", intensity: "MEDIUM" });
    }
    return results;
  }

  if (sourceType === "CAPABILITY") {
    results.push({ rewardType: "CAPABILITY_GROWTH", intensity: "HIGH" });
    return results;
  }

  if (sourceType === "IDENTITY") {
    results.push({ rewardType: "IDENTITY_ALIGNMENT", intensity: "HIGH" });
    return results;
  }

  if (sourceType === "MILESTONE" && params.blueprintId) {
    const eligible = await isMilestoneRewardEligible({
      milestoneId: String(source.id),
      userId: params.userId,
      blueprintId: params.blueprintId,
    });
    if (eligible) {
      results.push({ rewardType: "MILESTONE", intensity: "HIGH" });
    }
    return results;
  }

  if (sourceType === "OUTCOME") {
    const ov = source as typeof outcomeValidations.$inferSelect;
    if (ov.verdict === "VALIDATED" || ov.validation_result === "PASSED") {
      results.push({ rewardType: "OUTCOME_TRUTH", intensity: "HIGH" });
    }
    return results;
  }

  if (sourceType === "TASK_GENERATION") {
    results.push({ rewardType: "FOCUS_PROTECTION", intensity: "MEDIUM" });
  }

  return results;
}

export async function checkBlockingConditions(
  userId: string,
  blueprintId: string | undefined,
  rewardType: RewardType,
): Promise<BlockingResult> {
  void userId;
  if (!blueprintId) return { isBlocked: false };

  const anyFp = await hasOpenFalseProgress(blueprintId);
  const criticalFp = await hasCriticalFalseProgress(blueprintId);

  if (rewardType === "COMPLETION" && criticalFp) {
    return { isBlocked: true, reason: "false_progress_flag_critical" };
  }

  if (rewardType === "IDENTITY_ALIGNMENT" && anyFp) {
    return { isBlocked: true, reason: "false_progress_flag_open" };
  }

  if (rewardType === "OUTCOME_TRUTH" && anyFp) {
    return { isBlocked: true, reason: "false_progress_flag_open" };
  }

  if (rewardType === "CAPABILITY_GROWTH" && criticalFp) {
    return { isBlocked: true, reason: "false_progress_from_capability" };
  }

  return { isBlocked: false };
}
