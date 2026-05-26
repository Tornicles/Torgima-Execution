export type ExecutionType = "decision" | "simulation" | "team" | "organization" | "task";

export type ExecutionStatus = "pending" | "running" | "paused" | "completed" | "failed";

export interface ExecutionInput {
  blueprintId: string;
  executionType: ExecutionType;
  action: string;
  payload: Record<string, unknown>;
  estimatedDurationMs?: number;
}

export interface StoredExecutionContext {
  id: string;
  blueprintId: string;
  executionType: ExecutionType;
  executionId: string;
  action: string;
  input: Record<string, unknown>;
  status: ExecutionStatus;
  progress: number;
  startedAt: Date;
  completedAt: Date | null;
  estimatedEnd: Date | null;
  output: Record<string, unknown>;
  feedback: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionStats {
  total: number;
  successful: number;
  successRate: string;
  byType: Record<string, number>;
}

export interface ExecutionCompleteResult {
  success: boolean;
  outcome: string;
  durationMs: number;
  executionId: string;
}
