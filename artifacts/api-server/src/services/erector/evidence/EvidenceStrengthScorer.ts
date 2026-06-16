import type {
  EvidenceClass,
  EvidenceSourceType,
  EvidenceStrength,
  IntegrityFlag,
} from "./types.js";

export interface StrengthScoreInput {
  evidenceClass: EvidenceClass;
  sourceType: EvidenceSourceType | string;
  contentJson: Record<string, unknown>;
  contentSummary?: string;
  priorTaskCompletionCount: number;
  userHasHighEvidence: boolean;
}

function hasVerifiableExternalSource(contentJson: Record<string, unknown>): boolean {
  const source = String(contentJson.source_url ?? contentJson.verification_url ?? "").trim();
  return source.length > 0;
}

function hasMeasurableChange(contentJson: Record<string, unknown>): boolean {
  const delta = contentJson.delta ?? contentJson.change_pct ?? contentJson.metric_change;
  if (typeof delta === "number" && delta !== 0) return true;
  const before = contentJson.before;
  const after = contentJson.after;
  return before != null && after != null && before !== after;
}

function hasRealDeliverable(contentJson: Record<string, unknown>): boolean {
  return Boolean(
    contentJson.file_id ||
      contentJson.fileId ||
      contentJson.output_url ||
      contentJson.outputUrl ||
      (Array.isArray(contentJson.proof_file_ids) && contentJson.proof_file_ids.length > 0),
  );
}

function structuredProofComplete(contentJson: Record<string, unknown>): boolean {
  const answers = contentJson.checklist_answers ?? contentJson.checklistAnswers;
  if (!Array.isArray(answers)) return false;
  return answers.length > 0 && answers.every((a) => typeof a === "object" && a !== null);
}

function summaryContradictsClass(summary: string | undefined, evidenceClass: EvidenceClass): boolean {
  if (!summary?.trim()) return false;
  const lower = summary.toLowerCase();
  if (evidenceClass === "PAYMENT_PROOF" && /\b(no payment|unpaid|free)\b/.test(lower)) return true;
  if (evidenceClass === "ANALYTICS_MOVEMENT" && /\b(no change|flat|unchanged)\b/.test(lower)) return true;
  if (evidenceClass === "DIRECT_ARTIFACT" && /\b(no file|nothing attached)\b/.test(lower)) return true;
  return false;
}

function analyticsSuspicious(contentJson: Record<string, unknown>): boolean {
  const claimed = Number(contentJson.metric_value ?? contentJson.value ?? contentJson.claimed);
  const expected = Number(contentJson.expected_max ?? contentJson.baseline ?? 0);
  if (!Number.isFinite(claimed) || !Number.isFinite(expected) || expected <= 0) return false;
  return claimed > expected * 3;
}

export function baseStrengthForClass(
  evidenceClass: EvidenceClass,
  sourceType: EvidenceSourceType | string,
  contentJson: Record<string, unknown>,
): EvidenceStrength {
  switch (evidenceClass) {
    case "PAYMENT_PROOF":
      return "HIGH";
    case "EXTERNAL_CONFIRMATION":
      return hasVerifiableExternalSource(contentJson) ? "HIGH" : "MEDIUM";
    case "DIRECT_ARTIFACT":
      return hasRealDeliverable(contentJson) ? "HIGH" : "LOW-MEDIUM";
    case "ANALYTICS_MOVEMENT":
      return hasMeasurableChange(contentJson) ? "MEDIUM-HIGH" : "LOW";
    case "CUSTOMER_SIGNAL":
      return "MEDIUM";
    case "STRUCTURED_PROOF":
      return structuredProofComplete(contentJson) ? "MEDIUM" : "LOW-MEDIUM";
    case "USER_EXPLANATION":
      return "LOW-MEDIUM";
    case "TASK_COMPLETION_COUNT":
      return "LOW";
    case "BHUDHI_SUMMARY":
      return "LOW";
    case "INTENTION_OR_PLAN":
      return "NONE";
    default:
      return sourceType === "payment_signal" ? "HIGH" : "LOW";
  }
}

export function scoreEvidenceStrength(input: StrengthScoreInput): {
  evidence_strength: EvidenceStrength;
  integrity_flags: IntegrityFlag[];
} {
  const strength = baseStrengthForClass(input.evidenceClass, input.sourceType, input.contentJson);
  const integrity_flags: IntegrityFlag[] = [];

  if (
    (strength === "MEDIUM" || strength === "MEDIUM-HIGH") &&
    input.evidenceClass !== "PAYMENT_PROOF" &&
    input.evidenceClass !== "EXTERNAL_CONFIRMATION" &&
    input.evidenceClass !== "DIRECT_ARTIFACT" &&
    input.evidenceClass !== "ANALYTICS_MOVEMENT"
  ) {
    integrity_flags.push("SELF_REPORT_ONLY");
  }

  if (summaryContradictsClass(input.contentSummary, input.evidenceClass)) {
    integrity_flags.push("CLAIM_EVIDENCE_MISMATCH");
  }

  if (input.evidenceClass === "ANALYTICS_MOVEMENT" && analyticsSuspicious(input.contentJson)) {
    integrity_flags.push("SUSPICIOUS_METRIC");
  }

  if (
    input.evidenceClass === "TASK_COMPLETION_COUNT" &&
    input.priorTaskCompletionCount >= 5 &&
    !input.userHasHighEvidence
  ) {
    integrity_flags.push("REPEATED_LOW_VALUE");
  }

  return { evidence_strength: strength, integrity_flags };
}
