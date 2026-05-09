export type BhudhiTrigger =
  | "goal_validation"
  | "blueprint_generation"
  | "task_generation"
  | "task_regeneration"
  | "feedback_interpretation"
  | "feedback_interrogation"
  | "condition_explanation"
  | "recovery_suggestion"
  | "dashboard_summary";

export interface BhudhiRequest {
  trigger: BhudhiTrigger;
  userId: string;
  context: Record<string, unknown>;
  modelOverride?: string;
}

export interface BhudhiResponse {
  trigger: BhudhiTrigger;
  output: Record<string, unknown>;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  valid: boolean;
  fallbackUsed: boolean;
}

export interface BhudhiLogEntry {
  id: string;
  userId: string;
  trigger: BhudhiTrigger;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  valid: boolean;
  fallbackUsed: boolean;
  createdAt: string;
}
