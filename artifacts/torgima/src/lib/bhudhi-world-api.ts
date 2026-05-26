import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function syncBhudhiWorld(body: {
  blueprintId: string;
  trigger?: string;
  signals?: Record<string, unknown>;
}) {
  const res = await apiFetchEnvelope<{ world: Record<string, unknown> }>(
    "/api/bhudhi/world/sync",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return unwrap(res);
}

export async function predictBhudhiWorld(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    prediction: { next: string; confidence: number };
    entityCount: number;
  }>("/api/bhudhi/world/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}
