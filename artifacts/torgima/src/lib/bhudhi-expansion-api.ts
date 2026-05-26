import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function discoverExpansion(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    expansion: Record<string, unknown>;
    insight: string;
  }>("/api/bhudhi/expansion/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function evaluateExpansion(blueprintId: string) {
  const res = await apiFetchEnvelope<{ expansion: Record<string, unknown> }>(
    "/api/bhudhi/expansion/evaluate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}

export async function benchmarkExpansion(blueprintId: string) {
  const res = await apiFetchEnvelope<{ benchmark: Record<string, unknown> | null }>(
    "/api/bhudhi/expansion/benchmark",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}

export async function fetchExpansionStatus(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    status: {
      activeCapabilities: number;
      proposedCapabilities: number;
      pendingApprovals: number;
      canExpand: boolean;
      governanceRules: string[];
      capabilities: Array<{
        capabilityId: string;
        capabilityKey: string;
        status: string;
        score: number;
        risk: number;
      }>;
      recentHistory: Array<{ action: string; capabilityKey: string | null }>;
    };
  }>(`/api/bhudhi/expansion/status?blueprintId=${encodeURIComponent(blueprintId)}`);
  return unwrap(res);
}

export async function approveExpansionCapability(
  blueprintId: string,
  capabilityId: string,
  approved: boolean,
  promote = false,
) {
  const res = await apiFetchEnvelope<Record<string, unknown>>("/api/bhudhi/expansion/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, capabilityId, approved, promote }),
  });
  return unwrap(res);
}

export async function rollbackExpansionCapability(blueprintId: string, capabilityId: string) {
  const res = await apiFetchEnvelope<{ success: boolean; message: string }>(
    "/api/bhudhi/expansion/rollback",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId, capabilityId }),
    },
  );
  return unwrap(res);
}

export async function fetchExpansionHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{ action: string; capabilityKey: string | null; createdAt: string }>;
    capabilities: Array<{
      capabilityId: string;
      capabilityKey: string;
      status: string;
      score: number;
      risk: number;
    }>;
  }>("/api/bhudhi/expansion/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}
