/**
 * Security gate — validates BEFORE operating system executes (Prompt 4 requirement).
 */
import type { OperatingRecommendation } from "./types.js";
import type { SecurityValidation } from "./types.js";

const FORBIDDEN_EXECUTION_PHRASES = [
  "override",
  "bypass enforcement",
  "delete all",
  "force push",
  "mutate authority",
];

export function validateBeforeExecution(rec: OperatingRecommendation): SecurityValidation {
  const checks: Record<string, boolean> = {
    statusApproved: rec.status === "approved",
    confidenceFloor: rec.confidence >= 0.45,
    feasibilityOk: rec.feasibility?.feasible !== false,
    alignmentOk: rec.strategicAlignment?.aligned !== false,
    noForbiddenPhrases: !FORBIDDEN_EXECUTION_PHRASES.some(
      (p) =>
        rec.title.toLowerCase().includes(p) || rec.description.toLowerCase().includes(p),
    ),
    riskBounded: (rec.risks?.probability ?? 0) < 0.85,
  };

  const allowed = Object.values(checks).every(Boolean);
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);

  return {
    allowed,
    reason: allowed ? undefined : `Security gate blocked: ${failed.join(", ")}`,
    checks,
  };
}
