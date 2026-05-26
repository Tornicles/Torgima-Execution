import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export type BhudhiCertificationPayload = {
  overall: number;
  category: "not-ready" | "partial" | "production" | "enterprise";
  timestamp: string;
  version: string;
  brsLabel: string;
  scores: Array<{
    category: string;
    score: number;
    weight: number;
    criteria: Array<{ name: string; passed: boolean; score: number }>;
  }>;
  recommendations: string[];
  nextSteps: string[];
};

export async function fetchBhudhiCertification(): Promise<{
  certification: BhudhiCertificationPayload;
  insight?: string;
}> {
  const res = await apiFetchEnvelope<{
    certification: BhudhiCertificationPayload;
    insight?: string;
  }>("/api/bhudhi/certification");
  return unwrap(res);
}
