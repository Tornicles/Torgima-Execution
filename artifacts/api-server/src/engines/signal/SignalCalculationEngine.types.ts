/** Metrics derived from rolling execution feedback (Prompt 7 signal engine). */
export interface SignalMetrics {
  completion_rate: number;
  weighted_score: number;
  raw_score: number;
  momentum: number;
  trend: string;
  confidence: string;
  blocker_ratio: number;
  skip_ratio: number;
  tasks_in_window: number;
  avg_difficulty_felt: string | null;
}
