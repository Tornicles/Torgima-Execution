import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function createBhudhiCivilization(blueprintId: string, name?: string) {
  const res = await apiFetchEnvelope<{
    civilization: Record<string, unknown>;
    insight: string;
  }>("/api/bhudhi/civilization/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, name: name ?? "Blueprint Civilization" }),
  });
  return unwrap(res);
}

export async function simulateCivilization(blueprintId: string) {
  const res = await apiFetchEnvelope<{ civilization: Record<string, unknown> }>(
    "/api/bhudhi/civilization/simulate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}

export async function fetchCivilizationForecast(blueprintId: string) {
  const res = await apiFetchEnvelope<{ forecast: Record<string, unknown> }>(
    "/api/bhudhi/civilization/forecast",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}

export async function fetchCivilizationResilience(blueprintId: string) {
  const res = await apiFetchEnvelope<{ resilience: Record<string, unknown> }>(
    "/api/bhudhi/civilization/resilience",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}

export async function fetchBhudhiCivilizations(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    civilizations: Array<{
      id: string;
      name: string;
      population: number;
      institutions: number;
      resilience: number;
      trajectory: string;
      evolutionMode: string;
    }>;
  }>(`/api/bhudhi/civilizations?blueprintId=${encodeURIComponent(blueprintId)}`);
  return unwrap(res);
}

export async function simulateCivilizationYears(blueprintId: string, horizonYears = 10) {
  const res = await apiFetchEnvelope<{
    years: number;
    series: Array<Record<string, unknown>>;
    inflectionPoints: Array<{ year: number; from: string; to: string }>;
  }>("/api/bhudhi/civilization/simulate-years", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, horizonYears }),
  });
  return unwrap(res);
}

export async function fetchCivilizationHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{
      civilizationId: string;
      name: string;
      resilience: number;
      trajectory: string;
      evolutionMode: string;
    }>;
  }>("/api/bhudhi/civilization/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}
