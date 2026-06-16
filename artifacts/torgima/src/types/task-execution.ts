/** DOC 34 — task execution & feedback contracts */

export type FeedbackCompletion =
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "BLOCKED"
  | "SKIPPED";

export type ProofType = "NONE" | "TEXT" | "FILE" | "LINK" | "STEPS" | "OUTPUT";

export type OrderExecutionStatus =
  | "active"
  | "needs_feedback"
  | "completed"
  | "blocked"
  | "pending"
  | "paused"
  | "failed"
  | "skipped"
  | string;

export type DifficultyFelt = "too_easy" | "about_right" | "hard" | "too_hard";

export type TaskExecutionView = {
  orderId: string;
  stateVersion: number;
  title: string;
  instruction: string;
  whyItMatters?: string | null;
  expectedOutput?: string | null;
  definitionOfDone?: string | null;
  successCriteria: string[];
  taskType: string;
  difficulty: string;
  proofType: ProofType;
  proofInstruction: string;
  allowedFeedbackTypes: FeedbackCompletion[];
  priorityReason?: string | null;
  blocked: boolean;
  disabledReason?: string;
  timeEstimateMinutes?: number | null;
  proofRequired?: boolean;
  status?: OrderExecutionStatus;
  completionSummary?: string | null;
};

export type ProofState = {
  proofText?: string;
  proofFileIds: string[];
  proofFileId?: string | null;
  proofFileName?: string | null;
  proofLinks: string[];
  stepAnswers: Array<{ itemId: string; completed: boolean }>;
  outputFields?: Record<string, string>;
};

export type FeedbackFormState = {
  completion: FeedbackCompletion | null;
  proof: ProofState;
  durationMinutes?: number;
  effortScore?: 1 | 2 | 3 | 4 | 5;
  frictionScore?: 1 | 2 | 3 | 4 | 5;
  confidenceScore?: 1 | 2 | 3 | 4 | 5;
  blockerReason?: string;
  userNotes?: string;
  reflection?: string;
  score?: number;
  difficultyFelt?: DifficultyFelt;
};
