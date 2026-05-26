import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function sendProtocolMessage(
  blueprintId: string,
  from: string,
  to: string,
  uri: string,
  payload: Record<string, unknown>,
  autoRoute = true,
) {
  const res = await apiFetchEnvelope<{ messageId: string; result?: unknown }>(
    "/api/bhudhi/protocol/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId, from, to, uri, payload, autoRoute }),
    },
  );
  return unwrap(res);
}

export async function fetchProtocolHistory(blueprintId: string, limit = 50) {
  const res = await apiFetchEnvelope<{
    messages: Array<Record<string, unknown>>;
    count: number;
  }>(
    `/api/bhudhi/protocol/history?blueprintId=${encodeURIComponent(blueprintId)}&limit=${limit}`,
  );
  return unwrap(res);
}

export async function fetchProtocolRoutes() {
  const res = await apiFetchEnvelope<{
    routes: Array<Record<string, unknown>>;
    examples: Record<string, Record<string, unknown>>;
  }>("/api/bhudhi/protocol/routes");
  return unwrap(res);
}
