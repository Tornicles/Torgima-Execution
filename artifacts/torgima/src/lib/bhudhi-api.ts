/**
 * BHUDHI PROMPT 10/11 — typed client for Bhudhi API routes.
 */
import { apiFetchEnvelope, apiPost, type ApiEnvelope } from "@/lib/torgima-api";

export type BhudhiRecommendation = {
  id: string;
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  status?: string;
};

export type BhudhiStatusPayload = {
  success?: boolean;
  systems?: {
    total: number;
    active: number;
    systems: Array<{ name: string; status: string; engineCount: number }>;
  };
  engines?: {
    total: number;
    active: number;
    bySystem: Record<string, number>;
  };
  frameworks?: {
    total: number;
    team: number;
    individual: number;
    avgAccuracy: number;
  };
  domains?: { total: number; current: string | null };
  signals?: { global: string | null; confidence: number | null };
  insight?: string;
  nextSteps?: string[];
};

export type BhudhiSignalsPayload = {
  success?: boolean;
  signal?: string | null;
  confidence?: number | null;
  interpretation?: string;
  frameworkSignals?: Record<string, { signal?: string; reasoning?: string; confidence?: number }>;
  metrics?: Record<string, unknown>;
  insight?: string;
};

export type BhudhiInsightsPayload = {
  success?: boolean;
  insights?: string[];
  learnings?: Array<{ framework: string; learning: string; improvement: number }>;
  totalInsights?: number;
};

export type BhudhiRecommendationsPayload = {
  success?: boolean;
  recommendations?: BhudhiRecommendation[];
  count?: number;
  topRecommendation?: BhudhiRecommendation | null;
};

export type BhudhiConnectionsPayload = {
  success?: boolean;
  connections?: Array<{
    id: string;
    systemName: string;
    systemType: string;
    status: string;
    lastSyncAt?: string | null;
  }>;
  count?: number;
};

function unwrap<T>(envelope: ApiEnvelope<T>): T | null {
  if (!envelope.ok || envelope.data == null) return null;
  return envelope.data;
}

export async function fetchBhudhiStatus(blueprintId: string) {
  const res = await apiFetchEnvelope<BhudhiStatusPayload>(
    `/api/bhudhi/status?blueprintId=${encodeURIComponent(blueprintId)}`,
  );
  return unwrap(res);
}

export async function fetchBhudhiSignals(blueprintId: string) {
  const res = await apiFetchEnvelope<BhudhiSignalsPayload>(
    `/api/bhudhi/signals?blueprintId=${encodeURIComponent(blueprintId)}`,
  );
  return unwrap(res);
}

export async function calculateBhudhiSignals(blueprintId: string) {
  const res = await apiFetchEnvelope<BhudhiSignalsPayload>("/api/bhudhi/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function fetchBhudhiInsights(blueprintId: string) {
  const res = await apiFetchEnvelope<BhudhiInsightsPayload>(
    `/api/bhudhi/insights?blueprintId=${encodeURIComponent(blueprintId)}`,
  );
  return unwrap(res);
}

export async function fetchBhudhiRecommendations(blueprintId: string) {
  const res = await apiFetchEnvelope<{ recommendations: BhudhiRecommendation[]; count: number }>(
    `/api/bhudhi/recommendations/${encodeURIComponent(blueprintId)}`,
  );
  const data = unwrap(res);
  return {
    success: true,
    recommendations: data?.recommendations ?? [],
    count: data?.count ?? 0,
  } satisfies BhudhiRecommendationsPayload;
}

export async function generateBhudhiRecommendations(blueprintId: string) {
  const res = await apiFetchEnvelope<BhudhiRecommendationsPayload>("/api/bhudhi/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function fetchBhudhiConnections(blueprintId: string) {
  const res = await apiFetchEnvelope<BhudhiConnectionsPayload>(
    `/api/bhudhi/external/connections?blueprintId=${encodeURIComponent(blueprintId)}`,
  );
  return unwrap(res);
}

export async function runBhudhiInvestigate(blueprintId: string) {
  return apiPost<{ success: boolean; count: number }>("/api/bhudhi/investigate", { blueprintId });
}

export async function fetchBhudhiNextTask(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    nextTask: string;
    description?: string | null;
    reasoning?: string | null;
    confidence?: number | null;
  }>("/api/bhudhi/torgima/next-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export type Bhudhi20CyclePayload = {
  investigation: {
    context: { currentDomain: string; currentPhase: string; urgency: string; clarity: number };
    external: { marketTrends: string[]; threats: string[]; opportunities: string[] };
    behavior: { adoptionLikelihood: number; motivationLevel: string };
  };
  intelligence: {
    strategy: { selected: string; reasoning: string; confidence: number };
    prediction: { confidence: number; timeline: number };
  };
  executionPlan: { steps: Array<{ step: number; action: string }> };
  readyToExecute: boolean;
};

export async function fetchBhudhiModules() {
  const res = await apiFetchEnvelope<{
    count: number;
    modules: Array<{ name: string; system: string; description: string }>;
  }>("/api/bhudhi/modules");
  return unwrap(res);
}

export async function runBhudhiCompleteCycle(blueprintId: string) {
  const res = await apiFetchEnvelope<{ cycle: Bhudhi20CyclePayload; systems: Record<string, string> }>(
    "/api/bhudhi/modules/complete-cycle",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}

export async function executeBhudhiRecommendation(recommendationId: string, blueprintId: string) {
  const res = await apiFetchEnvelope<{ success: boolean; valid?: boolean; violations?: string[] }>(
    "/api/bhudhi/execute",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendationId, blueprintId }),
    },
  );
  return unwrap(res);
}
