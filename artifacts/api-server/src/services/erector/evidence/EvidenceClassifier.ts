import type { EvidenceClass, EvidenceSourceType } from "./types.js";

function contentType(contentJson: Record<string, unknown>): string | null {
  const t = contentJson.type;
  return typeof t === "string" ? t.toLowerCase() : null;
}

function isFileContent(contentJson: Record<string, unknown>): boolean {
  if (contentJson.file_id || contentJson.fileId) return true;
  if (Array.isArray(contentJson.proof_file_ids) && contentJson.proof_file_ids.length > 0) return true;
  if (contentJson.mime_type || contentJson.mimeType) return true;
  if (contentJson.output_url || contentJson.outputUrl) return true;
  return false;
}

function hasCustomerContact(contentJson: Record<string, unknown>): boolean {
  const blob = JSON.stringify(contentJson).toLowerCase();
  return /\b(email|phone|whatsapp|contact|conversation|message|call)\b/.test(blob);
}

function hasVerifiableExternalSource(contentJson: Record<string, unknown>): boolean {
  if (contentJson.verified === true || contentJson.verified_external === true) return true;
  const url = contentJson.url ?? contentJson.link ?? contentJson.source_url;
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

export function classifyEvidence(
  sourceType: EvidenceSourceType | string,
  contentJson: Record<string, unknown>,
): EvidenceClass {
  const normalizedSource = sourceType.toLowerCase();
  const jsonType = contentType(contentJson);

  if (jsonType === "checklist_completion") return "STRUCTURED_PROOF";
  if (jsonType === "text_explanation") return "USER_EXPLANATION";
  if (jsonType === "task_count") return "TASK_COMPLETION_COUNT";
  if (jsonType === "plan_or_intention") return "INTENTION_OR_PLAN";

  switch (normalizedSource) {
    case "payment_signal":
      return "PAYMENT_PROOF";
    case "customer_signal":
      return hasCustomerContact(contentJson) ? "CUSTOMER_SIGNAL" : "USER_EXPLANATION";
    case "analytics":
      return "ANALYTICS_MOVEMENT";
    case "external_confirmation":
      return "EXTERNAL_CONFIRMATION";
    case "bhudhi_summary":
      return "BHUDHI_SUMMARY";
    case "user_upload":
      return isFileContent(contentJson) ? "DIRECT_ARTIFACT" : "USER_EXPLANATION";
    case "external_link":
      return hasVerifiableExternalSource(contentJson) ? "EXTERNAL_CONFIRMATION" : "USER_EXPLANATION";
    default:
      if (isFileContent(contentJson)) return "DIRECT_ARTIFACT";
      if (jsonType === "structured_proof") return "STRUCTURED_PROOF";
      return "USER_EXPLANATION";
  }
}
