/**
 * DOC18 Task 3 — verified execution evidence only (never Bhudhi-invented).
 */

import {
  db,
  feedback,
  milestones,
  outcomeValidations,
  falseProgressFlags,
  inactivityRecords,
  capabilityHistory,
  enforcementPackages,
} from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { feedback as feedbackTable } from "@workspace/db";

type FeedbackRow = typeof feedbackTable.$inferSelect;

export interface TransformationEvidence {
  accepted_feedback_count_7d: number;
  accepted_feedback_count_14d: number;
  accepted_feedback_count_30d: number;
  consistency_7d: number;
  consistency_14d: number;
  recovery_tasks_completed: number;
  returned_after_inactivity: boolean;
  current_difficulty_level: number;
  capability_upgrades_proven: number;
  milestones_completed: number;
  outcomes_validated: number;
  critical_false_progress_open: boolean;
  any_false_progress_open: boolean;
  missed_windows_last_7_days: number;
  days_since_last_activity: number;
  current_streak_days: number;
  days_active_this_month: number;
}

export function isVerifiedFeedbackEvidence(row: FeedbackRow): boolean {
  if (row.validity !== "valid") return false;
  if (row.gaming_flag) return false;
  const interrogation = row.interrogation_json as { status?: string } | null;
  if (interrogation?.status === "pending" || interrogation?.status === "needs_interrogation") {
    return false;
  }
  if (row.confidence_score != null && row.confidence_score < 0.35) return false;
  return true;
}

async function loadVerifiedFeedback(
  userId: string,
  blueprintId: string,
  since: Date,
): Promise<FeedbackRow[]> {
  const rows = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, userId),
        eq(feedback.blueprint_id, blueprintId),
        gte(feedback.created_at, since),
      ),
    )
    .orderBy(desc(feedback.created_at));

  return rows.filter(isVerifiedFeedbackEvidence);
}

function calculateConsistency(rows: FeedbackRow[]): number {
  if (rows.length === 0) return 0;
  const completed = rows.filter((r) => r.completion_status === "completed").length;
  return completed / rows.length;
}

async function countAcceptedFeedback(
  userId: string,
  blueprintId: string,
  days: number,
): Promise<number> {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await loadVerifiedFeedback(userId, blueprintId, since);
  return rows.length;
}

async function calculateConsistencyWindow(
  userId: string,
  blueprintId: string,
  days: number,
): Promise<number> {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await loadVerifiedFeedback(userId, blueprintId, since);
  return calculateConsistency(rows);
}

async function countRecoveryTasksCompleted(
  userId: string,
  blueprintId: string,
): Promise<number> {
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await loadVerifiedFeedback(userId, blueprintId, since);
  return rows.filter(
    (r) =>
      r.completion_status === "completed" &&
      (Boolean(r.failure_correction_type) ||
        r.failure_classification === "recovery" ||
        (r.blocker_json as { recovery?: boolean } | null)?.recovery === true),
  ).length;
}

async function hasReturnedAfterInactivity(userId: string, blueprintId: string): Promise<boolean> {
  const since = new Date(Date.now() - 14 * 86400000);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.user_id, userId),
        eq(inactivityRecords.blueprint_id, blueprintId),
        eq(inactivityRecords.resolved, true),
        gte(inactivityRecords.resolved_at, since),
        sql`${inactivityRecords.response_triggered} IN ('returned_to_execution', 'cleared')`,
      ),
    );
  return (count ?? 0) > 0;
}

async function getCurrentDifficultyLevel(blueprintId: string): Promise<number> {
  const [pkg] = await db
    .select({ difficulty_cap: enforcementPackages.difficulty_cap })
    .from(enforcementPackages)
    .where(
      and(
        eq(enforcementPackages.blueprint_id, blueprintId),
        eq(enforcementPackages.is_current, true),
      ),
    )
    .limit(1);

  const cap = pkg?.difficulty_cap ?? "moderate";
  const map: Record<string, number> = {
    easy: 1,
    moderate: 3,
    hard: 4,
    extreme: 5,
  };
  return map[String(cap).toLowerCase()] ?? 3;
}

async function countCapabilityUpgrades(userId: string): Promise<number> {
  const since = new Date(Date.now() - 90 * 86400000);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(capabilityHistory)
    .where(
      and(
        eq(capabilityHistory.user_id, userId),
        gte(capabilityHistory.created_at, since),
        sql`${capabilityHistory.trigger_event} ILIKE '%upgrade%' OR ${capabilityHistory.trigger_event} ILIKE '%level%'`,
      ),
    );
  return count ?? 0;
}

async function countMilestonesCompleted(userId: string, blueprintId: string): Promise<number> {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(milestones)
    .where(and(eq(milestones.user_id, userId), eq(milestones.blueprint_id, blueprintId)));
  return count ?? 0;
}

async function countValidatedOutcomes(userId: string, blueprintId: string): Promise<number> {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outcomeValidations)
    .where(
      and(
        eq(outcomeValidations.user_id, userId),
        eq(outcomeValidations.blueprint_id, blueprintId),
        sql`(${outcomeValidations.validation_result} = 'PASSED' OR ${outcomeValidations.verdict} = 'VALIDATED')`,
      ),
    );
  return count ?? 0;
}

async function hasCriticalFalseProgressFlag(blueprintId: string): Promise<boolean> {
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

async function hasAnyFalseProgressFlag(blueprintId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: falseProgressFlags.id })
    .from(falseProgressFlags)
    .where(
      and(eq(falseProgressFlags.blueprint_id, blueprintId), eq(falseProgressFlags.resolved, false)),
    )
    .limit(1);
  return Boolean(row);
}

async function countMissedWindows(blueprintId: string, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86400000);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.blueprint_id, blueprintId),
        eq(inactivityRecords.inactivity_type, "MISSED_DUE_WINDOW"),
        gte(inactivityRecords.created_at, since),
      ),
    );
  return count ?? 0;
}

async function getDaysSinceLastActivity(userId: string, blueprintId: string): Promise<number> {
  const [lastFb] = await db
    .select({ created_at: feedback.created_at })
    .from(feedback)
    .where(and(eq(feedback.user_id, userId), eq(feedback.blueprint_id, blueprintId)))
    .orderBy(desc(feedback.created_at))
    .limit(1);

  if (!lastFb?.created_at) return 999;
  return Math.floor((Date.now() - lastFb.created_at.getTime()) / 86400000);
}

async function computeStreakDays(userId: string, blueprintId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 86400000);
  const rows = await loadVerifiedFeedback(userId, blueprintId, since);
  if (rows.length === 0) return 0;

  const daySet = new Set<string>();
  for (const row of rows) {
    daySet.add(row.created_at.toISOString().slice(0, 10));
  }

  const sortedDays = [...daySet].sort().reverse();
  let streak = 0;
  let cursor = new Date().toISOString().slice(0, 10);

  for (const day of sortedDays) {
    if (day === cursor || streak === 0) {
      streak++;
      const d = new Date(`${day}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }
  return streak;
}

async function computeDaysActiveThisMonth(userId: string, blueprintId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const rows = await loadVerifiedFeedback(userId, blueprintId, monthStart);
  const days = new Set(rows.map((r) => r.created_at.toISOString().slice(0, 10)));
  return days.size;
}

export class TransformationEvidenceCollector {
  async collect(userId: string, blueprintId: string): Promise<TransformationEvidence> {
    const [
      accepted_feedback_count_7d,
      accepted_feedback_count_14d,
      accepted_feedback_count_30d,
      consistency_7d,
      consistency_14d,
      recovery_tasks_completed,
      returned_after_inactivity,
      current_difficulty_level,
      capability_upgrades_proven,
      milestones_completed,
      outcomes_validated,
      critical_false_progress_open,
      any_false_progress_open,
      missed_windows_last_7_days,
      days_since_last_activity,
      current_streak_days,
      days_active_this_month,
    ] = await Promise.all([
      countAcceptedFeedback(userId, blueprintId, 7),
      countAcceptedFeedback(userId, blueprintId, 14),
      countAcceptedFeedback(userId, blueprintId, 30),
      calculateConsistencyWindow(userId, blueprintId, 7),
      calculateConsistencyWindow(userId, blueprintId, 14),
      countRecoveryTasksCompleted(userId, blueprintId),
      hasReturnedAfterInactivity(userId, blueprintId),
      getCurrentDifficultyLevel(blueprintId),
      countCapabilityUpgrades(userId),
      countMilestonesCompleted(userId, blueprintId),
      countValidatedOutcomes(userId, blueprintId),
      hasCriticalFalseProgressFlag(blueprintId),
      hasAnyFalseProgressFlag(blueprintId),
      countMissedWindows(blueprintId, 7),
      getDaysSinceLastActivity(userId, blueprintId),
      computeStreakDays(userId, blueprintId),
      computeDaysActiveThisMonth(userId, blueprintId),
    ]);

    return {
      accepted_feedback_count_7d,
      accepted_feedback_count_14d,
      accepted_feedback_count_30d,
      consistency_7d,
      consistency_14d,
      recovery_tasks_completed,
      returned_after_inactivity,
      current_difficulty_level,
      capability_upgrades_proven,
      milestones_completed,
      outcomes_validated,
      critical_false_progress_open,
      any_false_progress_open,
      missed_windows_last_7_days,
      days_since_last_activity,
      current_streak_days,
      days_active_this_month,
    };
  }
}

export const transformationEvidenceCollector = new TransformationEvidenceCollector();

export async function collectTransformationEvidence(
  userId: string,
  blueprintId: string,
): Promise<TransformationEvidence> {
  return transformationEvidenceCollector.collect(userId, blueprintId);
}
