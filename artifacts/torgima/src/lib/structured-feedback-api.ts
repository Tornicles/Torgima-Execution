import { apiFetchEnvelope } from "@/lib/torgima-api";

export type TaskRealityState =
  | "Finished"
  | "Partly Done"
  | "Started"
  | "Not Started"
  | "Blocked"
  | "Skipped";

export async function startStructuredFeedback(blueprintId: string, triggerType = "app_open") {
  return apiFetchEnvelope<{
    route: string;
    session: {
      id: string;
      showReflectionSection: boolean;
    } | null;
    unfinishedOrders: Array<{ id: string; title: string; status: string }>;
  }>("/api/feedback/start", {
    method: "POST",
    body: JSON.stringify({ blueprintId, triggerType }),
  });
}

export async function submitStructuredFeedback(payload: {
  sessionId: string;
  dailyReality?: string[];
  realitySummary?: string;
  taskStates: Array<{ task_id: string; state: TaskRealityState }>;
  emotionalState: string[];
  frictionType: string[];
  outputType: string[];
  reflectionSignal?: "yes_fine" | "no_change" | "help_understand";
}) {
  return apiFetchEnvelope<{
    submitted: boolean;
    signals: { production: number; operations: number; growth: number; scale: number };
    message: string;
  }>("/api/feedback/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchTodaySignals(blueprintId: string) {
  return apiFetchEnvelope<{ date: string; signals: Record<string, unknown> | null }>(
    `/api/signals/today?blueprintId=${encodeURIComponent(blueprintId)}`,
  );
}
