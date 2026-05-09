import { logger } from "../lib/logger.js";
import { TorgimaError } from "../lib/errors.js";
import { generateId, now } from "../lib/utils.js";
import type { Feedback } from "../types/feedback.js";

const store = new Map<string, Feedback>();

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
    // TODO: Emit feedback_submitted event → triggers signal recalculation
    return feedback;
  },

  async getRecent(userId: string, limit = 5): Promise<Feedback[]> {
    return Array.from(store.values())
      .filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  async submitWeeklyReview(
    userId: string,
    blueprintId: string,
    overallRating: number,
    wins: string[],
    challenges: string[],
    notes: string | null,
  ): Promise<Feedback> {
    const feedback: Feedback = {
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
    store.set(feedback.id, feedback);
    return feedback;
  },
};
