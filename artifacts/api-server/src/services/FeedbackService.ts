import { logger } from "../lib/logger.js";
import { generateId, now } from "../lib/utils.js";
import type { Feedback } from "../types/feedback.js";
import { db, feedback as feedbackTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const store = new Map<string, Feedback>();

function blockersFromJson(b: unknown): string[] {
  if (b === null || b === undefined) return [];
  if (Array.isArray(b)) return b.map(String);
  if (typeof b === "object") return Object.keys(b as object);
  return [];
}

function mapFeedbackRow(row: typeof feedbackTable.$inferSelect): Feedback {
  const completionRating =
    typeof row.score === "number"
      ? row.score
      : typeof row.weighted_score === "number"
        ? Math.round(row.weighted_score)
        : 0;

  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    type: "task",
    completionRating,
    effortRating: typeof row.duration_minutes === "number" ? row.duration_minutes : null,
    notes: row.reflection,
    blockers: blockersFromJson(row.blocker_json),
    processedAt: null,
    createdAt: row.created_at.toISOString(),
  };
}

export const FeedbackService = {
  async submit(
    userId: string,
    orderId: string,
    completionRating: number,
    effortRating: number | null,
    notes: string | null,
    blockers: string[],
  ): Promise<Feedback> {
    logger.info({ userId, orderId, completionRating }, "FeedbackService.submit");
    const feedback: Feedback = {
      id: generateId(),
      orderId,
      userId,
      type: "task",
      completionRating,
      effortRating,
      notes,
      blockers,
      processedAt: null,
      createdAt: now(),
    };
    store.set(feedback.id, feedback);
    return feedback;
  },

  async getRecent(userId: string, limit = 5): Promise<Feedback[]> {
    const rows = await db
      .select()
      .from(feedbackTable)
      .where(eq(feedbackTable.user_id, userId))
      .orderBy(desc(feedbackTable.created_at))
      .limit(limit);
    return rows.map(mapFeedbackRow);
  },

  async submitWeeklyReview(
    userId: string,
    blueprintId: string,
    overallRating: number,
    wins: string[],
    challenges: string[],
    notes: string | null,
  ): Promise<Feedback> {
    logger.info({ userId, blueprintId }, "FeedbackService.submitWeeklyReview");
    const fb: Feedback = {
      id: generateId(),
      orderId: `weekly_review_${blueprintId}`,
      userId,
      type: "weekly_review",
      completionRating: overallRating,
      effortRating: null,
      notes,
      blockers: challenges,
      processedAt: null,
      createdAt: now(),
    };
    store.set(fb.id, fb);
    return fb;
  },
};
