import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function createBhudhiOrganization(blueprintId: string, name?: string) {
  const res = await apiFetchEnvelope<{ organization: Record<string, unknown> }>(
    "/api/bhudhi/organization/create",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blueprintId,
        name: name ?? "Blueprint Organization",
        strategy: { vision: "Execute with alignment" },
      }),
    },
  );
  return unwrap(res);
}

export async function fetchOrganizationHistory(blueprintId: string, limit = 10) {
  const res = await apiFetchEnvelope<{
    history: Array<{ organizationId: string; name: string; healthScore: number }>;
  }>("/api/bhudhi/organization/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}
