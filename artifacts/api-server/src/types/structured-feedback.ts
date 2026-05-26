export type FeedbackTriggerType =
  | "app_open"
  | "task_finish"
  | "leaving"
  | "end_of_day"
  | "recovery";

export type TaskRealityState =
  | "Finished"
  | "Partly Done"
  | "Started"
  | "Not Started"
  | "Blocked"
  | "Skipped";

export type DailyRealityOption =
  | "worked_assigned"
  | "worked_other"
  | "learned"
  | "solved_problem"
  | "rested"
  | "nothing_significant";

export type EmotionalState =
  | "Focused"
  | "Good"
  | "Tired"
  | "Stressed"
  | "Confused"
  | "Distracted"
  | "Excited"
  | "Overwhelmed"
  | "Calm";

export type FrictionType =
  | "not_enough_time"
  | "low_energy"
  | "task_too_hard"
  | "confusing_unclear"
  | "tool_tech_issue"
  | "waiting_on_something"
  | "fear_hesitation"
  | "nothing_blocked";

export type OutputType =
  | "created"
  | "published"
  | "improved"
  | "learned"
  | "fixed"
  | "no_tangible_output";

export type ReflectionSignal = "yes_fine" | "no_change" | "help_understand";

export interface TaskStateEntry {
  task_id: string;
  state: TaskRealityState;
}

export interface EngineMetrics {
  completion_rate: number;
  output_score: number;
  execution_quality: number;
  energy_score: number;
  reflection_score: number;
  confidence: number;
  final_execution_score: number;
  production_signal: number;
  operations_signal: number;
  growth_signal: number;
  scale_signal: number;
  momentum: number;
}

export interface StructuredFeedbackSubmitPayload {
  sessionId: string;
  dailyReality?: DailyRealityOption[];
  realitySummary?: string;
  taskStates: TaskStateEntry[];
  emotionalState: EmotionalState[];
  frictionType: FrictionType[];
  outputType: OutputType[];
  reflectionSignal?: ReflectionSignal;
}

export type FeedbackEntryRoute =
  | "show_dashboard"
  | "show_progress"
  | "open_feedback"
  | "reflection_mode";
