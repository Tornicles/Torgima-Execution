import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export type ConvergenceUnifiedState = {
  blueprint: {
    id: string;
    goal: string;
    purpose: string | null;
    domain: string | null;
    currentCondition: string | null;
  };
  currentOrder: {
    id: string;
    title: string;
    instruction: string;
    expectedOutput: string;
    status: string;
  } | null;
  bhudhi: {
    signal: string;
    condition: string;
    control: string;
    recommendation: string | null;
    confidence: number | null;
  };
};

export async function fetchConvergenceState(blueprintId: string) {
  const res = await apiFetchEnvelope<{ state: ConvergenceUnifiedState }>(
    `/api/torgima/bhudhi/state?blueprintId=${encodeURIComponent(blueprintId)}`,
  );
  return unwrap(res).state;
}

export async function executeConvergenceGoal(
  blueprintId: string,
  options?: { createOrder?: boolean; syncRecommendations?: boolean },
) {
  const res = await apiFetchEnvelope<{ result: Record<string, unknown> }>(
    "/api/torgima/bhudhi/execute",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId, ...options }),
    },
  );
  return unwrap(res);
}

export async function submitConvergenceFeedback(
  blueprintId: string,
  orderId: string,
  feedback: Record<string, unknown>,
) {
  const res = await apiFetchEnvelope<{ result: Record<string, unknown> }>(
    "/api/torgima/bhudhi/feedback",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId, orderId, feedback }),
    },
  );
  return unwrap(res);
}
