export type EventType =
  | "feedback_submitted"
  | "task_started"
  | "task_completed"
  | "task_blocked"
  | "blueprint_activated"
  | "blueprint_paused"
  | "blueprint_resumed"
  | "blueprint_completed"
  | "signal_recalculated"
  | "condition_changed"
  | "phase_advanced"
  | "pivot_review_triggered";

export interface SystemEvent {
  id: string;
  type: EventType;
  userId: string;
  blueprintId: string | null;
  payload: Record<string, unknown>;
  processedAt: string | null;
  failedAt: string | null;
  retryCount: number;
  createdAt: string;
}
