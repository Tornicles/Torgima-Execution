import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function runBhudhiKernelCycle(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    cycle: Record<string, unknown>;
    chainId: string;
    status: string;
    message: string;
  }>("/api/bhudhi/kernel/cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function fetchKernelContext(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    context: Record<string, unknown>;
    validation: { valid: boolean; issues: string[] };
  }>(`/api/bhudhi/kernel/context?blueprintId=${encodeURIComponent(blueprintId)}`);
  return unwrap(res);
}

export async function fetchKernelEvents(blueprintId: string, chainId?: string) {
  const params = new URLSearchParams({ blueprintId });
  if (chainId) params.set("chainId", chainId);
  const res = await apiFetchEnvelope<{
    events: Array<Record<string, unknown>>;
    count: number;
  }>(`/api/bhudhi/kernel/events?${params.toString()}`);
  return unwrap(res);
}
