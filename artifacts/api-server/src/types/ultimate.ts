export interface ExecutionHistoryEntry {
  taskName: string;
  estimatedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  blockersEncountered: string[];
}

export interface PredictionPayload {
  predicted_task: string;
  task_confidence: number;
  predicted_blockers: string[];
  blocker_risk: number;
  predicted_duration: number;
}

export interface SceneStateSnapshot {
  tasks_completed?: number;
  tasks_total?: number;
  progress_percentage?: number;
  production_signal?: number;
  operations_signal?: number;
  condition?: string;
  current_scene_text?: string;
  timestamp?: string;
  [key: string]: unknown;
}
