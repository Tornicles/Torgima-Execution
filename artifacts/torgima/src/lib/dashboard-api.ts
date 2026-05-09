import { customFetch } from "@workspace/api-client-react";

export interface CompletionSummary {
  blueprintId: string;
  goal: string | null;
  completedAt: string | Date | null;
  daysToCompletion: number;
  tasksCompleted: number;
  averageScore: number;
  milestones: Array<{ type: string; title: string | null; date: string | Date }>;
  finalIdentityStage: string;
  finalCapabilityLevel: string;
  capabilityCarriesForward: boolean;
  identityCarriesForward: boolean;
  signalsCarryForward: boolean;
}

export async function fetchCompletionSummary(blueprintId: string): Promise<CompletionSummary> {
  return customFetch<CompletionSummary>(
    `/api/blueprints/${encodeURIComponent(blueprintId)}/completion-summary`,
  );
}

export interface PauseStatusPayload {
  isPaused: boolean;
  pausedAt: string | Date | null;
  pauseReason: string | null;
  pauseGapDays: number;
  resumeMode: string | null;
  goal: string | null;
}

export async function fetchPauseStatus(blueprintId: string): Promise<PauseStatusPayload> {
  return customFetch<PauseStatusPayload>(
    `/api/blueprints/${encodeURIComponent(blueprintId)}/pause-status`,
  );
}

export type PivotPathChoice = "continue" | "adjust" | "pivot";

export async function resolvePivotReviewRequest(
  blueprintId: string,
  reviewId: string,
  body: { selectedPath: PivotPathChoice; confirmed: boolean },
): Promise<{ resolved: true; selectedPath: PivotPathChoice }> {
  return customFetch(
    `/api/blueprints/${encodeURIComponent(blueprintId)}/pivot-review/${encodeURIComponent(reviewId)}/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function dismissPivotReviewRequest(
  blueprintId: string,
  reviewId: string,
): Promise<{ dismissed: boolean }> {
  return customFetch(
    `/api/blueprints/${encodeURIComponent(blueprintId)}/pivot-review/${encodeURIComponent(reviewId)}/dismiss`,
    { method: "POST" },
  );
}
