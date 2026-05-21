/**
 * GAP G8 / DOC_27 — source trust registry and confidence mapping.
 */

export type ExternalTrustLevel = "UNTRUSTED" | "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";

export const SOURCE_TRUST_LEVELS: Record<string, ExternalTrustLevel> = {
  stripe_webhook: "HIGH",
  google_calendar: "MEDIUM",
  apple_health: "MEDIUM",
  manual_evidence: "LOW",
  linkedin_post: "LOW",
};

export const PHASE2_WEBHOOK_SOURCES = [
  "stripe_webhook",
  "google_calendar",
  "apple_health",
] as const;

export function resolveSourceTrust(sourceName: string): ExternalTrustLevel {
  return SOURCE_TRUST_LEVELS[sourceName] ?? "UNTRUSTED";
}

export function confidenceFromTrust(trust: ExternalTrustLevel): number {
  const map: Record<ExternalTrustLevel, number> = {
    VERIFIED: 1.0,
    HIGH: 0.85,
    MEDIUM: 0.6,
    LOW: 0.4,
    UNTRUSTED: 0,
  };
  return map[trust] ?? 0;
}
