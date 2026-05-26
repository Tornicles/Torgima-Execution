import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export type BhudhiMonitoringHealth = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version?: string;
  checks?: Record<string, boolean>;
  latencies?: Record<string, number>;
  counts?: Record<string, number | null>;
  errors?: string[];
};

export type BhudhiMonitoringMetrics = {
  timestamp: string;
  environment: string;
  version: string;
  platform?: {
    health?: { status: string; checks?: Record<string, string> };
    bhudhi?: BhudhiMonitoringHealth;
  };
  bhudhi?: {
    kernelEventsLast24h: number | null;
    protocolMessagesLast24h: number | null;
    memoryNodes: number | null;
    executionsLast24h: number | null;
    runtimeSuccessRate: number | null;
  };
};

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
}

export async function fetchPlatformHealth(): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiBase()}/api/health`, { credentials: "include" });
  return res.json() as Promise<Record<string, unknown>>;
}

export async function fetchPlatformMetrics(): Promise<BhudhiMonitoringMetrics> {
  const res = await fetch(`${apiBase()}/api/metrics`, { credentials: "include" });
  return res.json() as Promise<BhudhiMonitoringMetrics>;
}

export async function fetchBhudhiMonitoringHealth(): Promise<BhudhiMonitoringHealth> {
  const res = await apiFetchEnvelope<BhudhiMonitoringHealth>("/api/bhudhi/monitoring/health");
  return unwrap(res);
}

export async function fetchBhudhiMonitoringMetrics(): Promise<{ metrics: BhudhiMonitoringMetrics }> {
  const res = await apiFetchEnvelope<{ metrics: BhudhiMonitoringMetrics }>(
    "/api/bhudhi/monitoring/metrics",
  );
  return unwrap(res);
}
