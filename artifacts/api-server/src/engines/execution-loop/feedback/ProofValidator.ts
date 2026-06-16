import type { orders } from "@workspace/db";
import type { FeedbackSubmissionPayload } from "../../feedback/submitFeedbackPhase1.js";

export type ProofValidationResult = {
  valid: boolean;
  rejection_reason?: string;
  proof_class: string;
};

const BLOCKED_LINK_DOMAINS = ["bit.ly", "tinyurl.com", "localhost"];

function repeatedWords(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;
  const unique = new Set(words);
  return unique.size <= Math.ceil(words.length / 3);
}

function parseHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function validateProof(params: {
  payload: FeedbackSubmissionPayload;
  order: typeof orders.$inferSelect;
  priorProofLinks?: string[];
}): ProofValidationResult {
  const { payload, order, priorProofLinks = [] } = params;
  const proofType = payload.proofType ?? (order.proof_required ? "TEXT" : "NONE");

  if (!order.proof_required || proofType === "NONE") {
    return { valid: true, proof_class: "NONE" };
  }

  switch (proofType) {
    case "TEXT": {
      const text = (payload.proofText ?? payload.userNotes ?? "").trim();
      if (text.length < 50) {
        return { valid: false, rejection_reason: "Text proof too short", proof_class: "TEXT" };
      }
      // Long structured proof text is never gaming — skip repetition heuristic.
      if (text.length > 2000) {
        return { valid: true, proof_class: "TEXT" };
      }
      if (repeatedWords(text)) {
        return {
          valid: false,
          rejection_reason: "Proof does not describe expected output",
          proof_class: "TEXT",
        };
      }
      const expected = (order.expected_output as string | null) ?? order.title ?? "";
      if (expected.length >= 5 && text.length < 80) {
        return {
          valid: false,
          rejection_reason: "Proof does not describe expected output",
          proof_class: "TEXT",
        };
      }
      return { valid: true, proof_class: "TEXT" };
    }
    case "FILE": {
      const ids = payload.proofFileIds ?? [];
      if (ids.length === 0) {
        return { valid: false, rejection_reason: "File not found", proof_class: "FILE" };
      }
      const allowed = ((order.proof_json as Record<string, unknown> | null)?.allowed_types ??
        ["image/png", "image/jpeg", "application/pdf"]) as string[];
      const mime = String((order.proof_json as Record<string, unknown> | null)?.mime_type ?? "application/pdf");
      if (allowed.length > 0 && !allowed.includes(mime)) {
        return { valid: false, rejection_reason: "File type not allowed", proof_class: "FILE" };
      }
      const sizeBytes = Number((order.proof_json as Record<string, unknown> | null)?.size_bytes ?? 0);
      if (sizeBytes > 10_000_000) {
        return { valid: false, rejection_reason: "File too large", proof_class: "FILE" };
      }
      return { valid: true, proof_class: "FILE" };
    }
    case "LINK": {
      const links = payload.proofLinks ?? [];
      if (links.length === 0) {
        return { valid: false, rejection_reason: "Invalid URL format", proof_class: "LINK" };
      }
      for (const link of links) {
        if (!/^https:\/\/.+/i.test(link)) {
          return { valid: false, rejection_reason: "Invalid URL format", proof_class: "LINK" };
        }
        const host = parseHostname(link);
        if (host && BLOCKED_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
          return { valid: false, rejection_reason: "Invalid URL format", proof_class: "LINK" };
        }
        if (priorProofLinks.includes(link)) {
          return { valid: false, rejection_reason: "Link already submitted", proof_class: "LINK" };
        }
      }
      return { valid: true, proof_class: "LINK" };
    }
    case "CHECKLIST": {
      const answers = payload.checklistAnswers ?? [];
      const required =
        ((order.proof_json as Record<string, unknown> | null)?.required_items as string[] | undefined) ??
        [];
      if (required.length === 0) {
        return answers.some((a) => a.completed)
          ? { valid: true, proof_class: "CHECKLIST" }
          : { valid: false, rejection_reason: "Required checklist item [all] is missing", proof_class: "CHECKLIST" };
      }
      for (const itemId of required) {
        const row = answers.find((a) => a.itemId === itemId);
        if (!row?.completed) {
          return {
            valid: false,
            rejection_reason: `Required checklist item [${itemId}] is missing`,
            proof_class: "CHECKLIST",
          };
        }
      }
      return { valid: true, proof_class: "CHECKLIST" };
    }
    case "OUTPUT": {
      const requiredFields =
        ((order.proof_json as Record<string, unknown> | null)?.required_output_fields as string[] | undefined) ??
        [];
      const output = (payload.proofText ? { summary: payload.proofText } : {}) as Record<string, string>;
      for (const field of requiredFields) {
        const value = output[field]?.trim();
        if (!value) {
          return {
            valid: false,
            rejection_reason: `Required output field [${field}] is missing`,
            proof_class: "OUTPUT",
          };
        }
      }
      return { valid: true, proof_class: "OUTPUT" };
    }
    default:
      return { valid: true, proof_class: proofType };
  }
}
