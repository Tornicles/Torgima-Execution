import type { orders as ordersTable } from "@workspace/db";

type OrderRow = typeof ordersTable.$inferSelect;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Deterministic proof completeness (0–1). Interpretation hooks only — does not authorize completion
 * (order flow still uses proof_required + non-empty proof_json).
 */
export function scoreProofForOrder(order: OrderRow, proofJson: Record<string, unknown>): {
  normalized: number;
  formula: string;
  rationale: string;
} {
  if (!order.proof_required) {
    return {
      normalized: 1,
      formula: "if !proof_required then 1",
      rationale: "No proof requirement on this order.",
    };
  }

  const keys = Object.keys(proofJson);
  if (keys.length === 0) {
    return {
      normalized: 0,
      formula: "len(proof_json_keys)==0 ⇒ 0",
      rationale: "Proof required but payload empty.",
    };
  }

  let acc = 0.25;
  const present: string[] = [];

  const getStr = (...k: string[]) => k.map((x) => proofJson[x]).find((v) => typeof v === "string") as string | undefined;

  const url = getStr("url", "link", "reference_url", "referenceUrl");
  if (url && /^https?:\/\//i.test(url)) {
    acc += 0.25;
    present.push("url");
  }

  const text = getStr("text", "note", "summary");
  if (text && text.trim().length >= 24) {
    acc += 0.2;
    present.push("text");
  }

  const shot = proofJson["screenshot_url"] ?? proofJson["screenshot"];
  if (typeof shot === "string" && shot.length > 8) {
    acc += 0.2;
    present.push("screenshot_reference");
  }

  const artifact = proofJson["artifacts"];
  if (Array.isArray(artifact) && artifact.length > 0) {
    acc += 0.07 * Math.min(artifact.length, 3);
    present.push("artifacts");
  }

  const externalOk = proofJson["external_validation"] === true || proofJson["validated"] === true;
  if (externalOk) {
    acc += 0.08;
    present.push("external_validation_flag");
  }

  const normalized = clamp01(acc);
  return {
    normalized,
    formula:
      "0.25_base + url(0.25) + text(0.2) + screenshot(0.2) + 0.07*min(len(artifacts),3) + external(0.08), clamp01",
    rationale: `Signals present in proof_json: ${present.join(", ") || "minimal structure only"}`,
  };
}
