import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function fetchEconomicsOverview(blueprintId?: string) {
  const q = blueprintId ? `?blueprintId=${encodeURIComponent(blueprintId)}` : "";
  const res = await apiFetchEnvelope<{
    profile: Record<string, unknown>;
    metrics: Record<string, unknown>;
    optimizationProposals: Array<{ id: string; description: string }>;
  }>(`/api/bhudhi/economics/overview${q}`);
  return unwrap(res);
}

export async function fetchEconomicsModels() {
  const res = await apiFetchEnvelope<{ models: Array<{ modelId: string; valueScore: number }> }>(
    "/api/bhudhi/economics/models",
  );
  return unwrap(res);
}

export async function fetchEconomicsForecast(blueprintId?: string) {
  const q = blueprintId ? `?blueprintId=${encodeURIComponent(blueprintId)}` : "";
  const res = await apiFetchEnvelope<{
    forecasts: Array<{ horizonDays: number; costUsd: number; tokens: number }>;
  }>(`/api/bhudhi/economics/forecast${q}`);
  return unwrap(res);
}

export async function previewEconomicsRoute(body: {
  trigger: string;
  blueprintId?: string;
  confidence?: number;
}) {
  const res = await apiFetchEnvelope<{ plan: Record<string, unknown>; cheapestSafePath: string }>(
    "/api/bhudhi/economics/route",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return unwrap(res);
}
