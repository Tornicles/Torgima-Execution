/**
 * Prompt 7 §4.2 — burnout risk bands (non-clinical, pattern-window based).
 */

export type BurnoutRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type BurnoutAssessmentInput = {
  avgFriction: number;
  failureRate: number;
  avgConfidence: number;
  windowEventCount: number;
};

export type BurnoutAssessment = {
  riskLevel: BurnoutRiskLevel;
  fatigueScore: number;
  recommendedResponse: "observe" | "reduce_friction" | "recovery_task" | "protective_restart";
  /** Plain-language only — never clinical diagnosis. */
  narrative: string;
};

export function assessBurnoutRisk(input: BurnoutAssessmentInput): BurnoutAssessment {
  if (input.windowEventCount < 3) {
    return {
      riskLevel: "LOW",
      fatigueScore: 0,
      recommendedResponse: "observe",
      narrative: "Insufficient execution window to assess fatigue trajectory.",
    };
  }

  const fatigueScore =
    (input.avgFriction / 5) * 0.4 +
    input.failureRate * 0.4 +
    (1 - input.avgConfidence) * 0.2;

  const riskLevel: BurnoutRiskLevel =
    fatigueScore >= 0.7 ? "CRITICAL"
    : fatigueScore >= 0.5 ? "HIGH"
    : fatigueScore >= 0.3 ? "MEDIUM"
    : "LOW";

  const recommendedResponse =
    riskLevel === "CRITICAL" ? "protective_restart"
    : riskLevel === "HIGH" ? "recovery_task"
    : riskLevel === "MEDIUM" ? "reduce_friction"
    : "observe";

  const narrative =
    riskLevel === "CRITICAL"
      ? "Execution load and friction are elevated — the system will reduce task density and prioritize recovery."
      : riskLevel === "HIGH"
        ? "Sustained friction suggests load reduction and a recovery-oriented next order."
        : riskLevel === "MEDIUM"
          ? "Mild fatigue signals detected — task wording and pacing may adjust."
          : "Trajectory is stable within the current window.";

  return { riskLevel, fatigueScore, recommendedResponse, narrative };
}
