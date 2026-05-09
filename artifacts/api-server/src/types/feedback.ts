export type FeedbackType =
  | "task"
  | "weekly_review"
  | "phase_checkpoint"
  | "habit_checkin";

export interface Feedback {
  id: string;
  orderId: string;
  userId: string;
  type: FeedbackType;
  completionRating: number;
  effortRating: number | null;
  notes: string | null;
  blockers: string[];
  processedAt: string | null;
  createdAt: string;
}
