/**
 * DOC27 Task 3 — trust scoring for external signals.
 */

import {
  TRUSTED_DOMAINS,
  type ExternalSignalType,
  type ExternalTrustLevel,
  type TrustScore,
} from "./externalTypes.js";

export type TrustScoreInput = {
  sourceType: ExternalSignalType | string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  description?: string;
  uploadedBy?: string;
  signatureVerified?: boolean;
  sourceApproved?: boolean;
  userHasHighTrustHistory?: boolean;
  possibleFabricationRecent?: boolean;
  repeatedUrlSubmissions?: number;
};

function levelFromScore(score: number): ExternalTrustLevel {
  if (score >= 90) return "VERIFIED";
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isTrustedDomain(url: string): boolean {
  const host = domainFromUrl(url);
  if (!host) return false;
  return TRUSTED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function urlSuggestsOutcomeEvidence(url: string): boolean {
  const lower = url.toLowerCase();
  return /\b(payment|invoice|receipt|payout|charge|confirmed|success)\b/.test(lower);
}

function isStructuredProofMime(fileType?: string): boolean {
  if (!fileType) return false;
  const lower = fileType.toLowerCase();
  return (
    lower === "application/pdf" ||
    lower.includes("spreadsheet") ||
    lower.includes("excel") ||
    lower.endsWith(".xlsx")
  );
}

export function scoreExternalTrust(input: TrustScoreInput): TrustScore {
  const sourceType = input.sourceType as ExternalSignalType;

  if (sourceType === "approved_webhook") {
    if (input.signatureVerified === false) {
      return { level: "LOW", score: 0 };
    }
    let score = 80;
    if (input.signatureVerified && input.sourceApproved) score += 20;
    return { level: levelFromScore(score), score: Math.min(100, score) };
  }

  if (sourceType === "external_link") {
    let score = 30;
    if (input.url && isTrustedDomain(input.url)) score += 20;
    if (input.url && urlSuggestsOutcomeEvidence(input.url)) score += 10;
    if ((input.repeatedUrlSubmissions ?? 0) >= 3) score -= 10;
    score = Math.max(0, score);
    return { level: levelFromScore(score), score };
  }

  if (sourceType === "internal_metric") {
    return { level: "VERIFIED", score: 95 };
  }

  if (sourceType === "manual_confirmation") {
    return { level: "HIGH", score: 85 };
  }

  // user_upload default
  let score = 50;
  if (isStructuredProofMime(input.fileType)) score += 20;
  if ((input.description?.trim().length ?? 0) < 20) score -= 10;
  if (input.userHasHighTrustHistory) score += 10;
  if (input.possibleFabricationRecent) score -= 20;
  score = Math.max(0, Math.min(100, score));
  return { level: levelFromScore(score), score };
}

export function confidenceFromTrustLevel(level: ExternalTrustLevel): number {
  switch (level) {
    case "VERIFIED":
      return 1;
    case "HIGH":
      return 0.85;
    case "MEDIUM":
      return 0.6;
    default:
      return 0.4;
  }
}

export function evidenceStrengthFromTrust(level: ExternalTrustLevel): string {
  switch (level) {
    case "VERIFIED":
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "MEDIUM";
    default:
      return "LOW-MEDIUM";
  }
}

export function canTriggerOutcomeReward(level: ExternalTrustLevel): boolean {
  return level === "HIGH" || level === "VERIFIED";
}
