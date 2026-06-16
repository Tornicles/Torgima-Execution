import type { EvidenceRecord } from "../../services/erector/evidence/types.js";

export interface FeedbackEvidenceItem {
  source: "feedback";
  source_id: string;
  evidence_class: string;
  evidence_strength: string;
  content_summary?: string;
}

export type MergedEvidenceItem = EvidenceRecord | FeedbackEvidenceItem;

const LEDGER_PRIORITY_CLASSES = new Set(["PAYMENT_PROOF", "EXTERNAL_CONFIRMATION"]);

export function mergeAndDeduplicateEvidence(
  feedbackEvidence: FeedbackEvidenceItem[],
  ledgerEvidence: EvidenceRecord[],
): MergedEvidenceItem[] {
  const merged: MergedEvidenceItem[] = [...ledgerEvidence];
  const ledgerKeys = new Set(
    ledgerEvidence.map((row) => `${row.evidence_class}:${row.content_summary ?? ""}`),
  );

  for (const item of feedbackEvidence) {
    if (LEDGER_PRIORITY_CLASSES.has(item.evidence_class)) continue;
    const key = `${item.evidence_class}:${item.content_summary ?? ""}`;
    if (ledgerKeys.has(key)) continue;
    merged.push(item);
  }

  return merged;
}

export function ledgerOverridesFeedbackStrength(
  ledgerEvidence: EvidenceRecord[],
  feedbackStrength: number,
): number {
  const hasPriority = ledgerEvidence.some((row) =>
    LEDGER_PRIORITY_CLASSES.has(row.evidence_class),
  );
  if (hasPriority) {
    return Math.max(feedbackStrength, 75);
  }
  return feedbackStrength;
}

export function feedbackItemsFromProof(
  feedbackRows: Array<{ id: string; proof_json: unknown }>,
): FeedbackEvidenceItem[] {
  return feedbackRows
    .filter((row) => {
      if (row.proof_json && typeof row.proof_json === "object" && !Array.isArray(row.proof_json)) {
        return Object.keys(row.proof_json as Record<string, unknown>).length > 0;
      }
      return false;
    })
    .map((row) => ({
      source: "feedback" as const,
      source_id: row.id,
      evidence_class: "STRUCTURED_PROOF",
      evidence_strength: "MEDIUM",
    }));
}
