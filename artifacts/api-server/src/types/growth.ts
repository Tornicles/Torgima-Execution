export type InterrogationCategory =
  | "blocker"
  | "execution_style"
  | "environment"
  | "capability";

export type FeedbackSentiment = "positive" | "neutral" | "negative";

export interface InterrogationContext {
  recent_feedback: Array<Record<string, unknown>>;
  current_sequence: number;
  pattern_suspected: string;
  feedback_sentiment: FeedbackSentiment;
}

export interface InterrogationInsight {
  insight: string;
  actionable: boolean;
  suggested_adjustment?: string;
  reasoning: string;
  confidence: number;
}

export interface DetectedExecutionPattern {
  type: string;
  name: string;
  occurrences: number;
  confidence: number;
  impact?: "positive" | "negative" | "neutral";
  suggestion?: string;
}

export interface GrowthFeedbackRow {
  completion_status?: string | null;
  score?: number | null;
  weighted_score?: number | null;
  reflection?: string | null;
  blocker_json?: unknown;
  duration_minutes?: number | null;
}
