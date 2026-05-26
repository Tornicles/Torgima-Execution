import type { InvestigationInput } from "./types.js";

export function insightText(investigations: InvestigationInput): string {
  return investigations.flatMap((i) => i.findings.insights ?? []).join(" ").toLowerCase();
}

export function hasInsight(investigations: InvestigationInput, ...needles: string[]): boolean {
  const text = insightText(investigations);
  return needles.some((n) => text.includes(n.toLowerCase()));
}

export function anomalyCount(investigations: InvestigationInput): number {
  return investigations.reduce((n, i) => n + (i.findings.anomalies?.length ?? 0), 0);
}

export function avgConfidence(investigations: InvestigationInput): number {
  if (investigations.length === 0) return 0.75;
  return investigations.reduce((s, i) => s + i.confidence, 0) / investigations.length;
}

/** Scale confidence down when investigations show stress signals. */
export function adjustConfidence(base: number, investigations: InvestigationInput): number {
  const penalty = anomalyCount(investigations) * 0.05 + (hasInsight(investigations, "danger", "risk", "gaming") ? 0.08 : 0);
  return Math.max(0.35, Math.min(0.98, base - penalty + avgConfidence(investigations) * 0.05));
}
