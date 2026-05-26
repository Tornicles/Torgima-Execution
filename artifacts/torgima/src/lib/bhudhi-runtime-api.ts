import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export type ExecutionType = "decision" | "simulation" | "team" | "organization" | "task";

export async function runUnifiedExecution(
  blueprintId: string,
  executionType: ExecutionType,
  payload: Record<string, unknown>,
) {
  const res = await apiFetchEnvelope<{ execution: Record<string, unknown> }>(
    "/api/bhudhi/runtime/execute",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId, executionType, payload }),
    },
  );
  return unwrap(res);
}

export async function fetchExecutionStats(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    stats: {
      total: number;
      successful: number;
      successRate: string;
      byType: Record<string, number>;
    };
  }>(`/api/bhudhi/execution/stats?blueprintId=${encodeURIComponent(blueprintId)}`);
  return unwrap(res);
}

export async function fetchExecutionHistory(blueprintId: string, limit = 30) {
  const res = await apiFetchEnvelope<{
    executions: Array<Record<string, unknown>>;
    count: number;
  }>(
    `/api/bhudhi/runtime/history?blueprintId=${encodeURIComponent(blueprintId)}&limit=${limit}`,
  );
  return unwrap(res);
}
