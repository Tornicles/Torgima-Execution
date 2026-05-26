import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export type BhudhiPricingTierId = "free" | "pro" | "enterprise";

export interface BhudhiLaunchConfig {
  environment: {
    name: string;
    apiUrl: string;
    features: Record<string, boolean>;
    limits: Record<string, number>;
    telemetry: { enabled: boolean; sampleRate: number };
  };
  pricing: Array<{
    id: BhudhiPricingTierId;
    name: string;
    monthlyPrice: number;
    description: string;
    torgimaTier: string;
    limits: Record<string, number | boolean>;
  }>;
}

export interface BhudhiLaunchOnboardBody {
  name: string;
  organization?: string;
  useCase: string;
  tier: BhudhiPricingTierId;
}

export async function fetchBhudhiLaunchConfig(): Promise<BhudhiLaunchConfig> {
  const res = await apiFetchEnvelope<BhudhiLaunchConfig>("/api/bhudhi/launch/config");
  return unwrap(res);
}

export async function fetchBhudhiLaunchStatus(): Promise<Record<string, unknown>> {
  const res = await apiFetchEnvelope<Record<string, unknown>>("/api/bhudhi/launch/status");
  return unwrap(res);
}

export async function postBhudhiLaunchOnboard(body: BhudhiLaunchOnboardBody) {
  const res = await apiFetchEnvelope<{
    onboarding: Record<string, unknown>;
    limits: Record<string, unknown>;
    redirect: string;
  }>("/api/bhudhi/launch/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap(res);
}

export async function postTelemetryEvents(
  events: Array<{
    event: string;
    blueprintId?: string;
    properties?: Record<string, unknown>;
  }>,
) {
  await apiFetchEnvelope("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });
}
