import { FORBIDDEN_OUTPUT_PHRASES } from "../../bhudhi/agents/SelfImprovementAgent.js";

export interface SevenDayJourneyStatus {
  day0OnboardingComplete: boolean;
  day1PrimaryLoopMs: number;
  day3AcademyResumed: boolean;
  day5PsychologyFired: boolean;
  day6GovernanceApproved: boolean;
  day7DashboardPanels: number;
  activeOrderContinuity: boolean;
  signalDriftCount: number;
}

export interface PresenceScoreInput {
  morningReportSpecificity: number;
  taskInstructionRelevance: number;
  conditionExplanationQuality: number;
  behavioralInsightAccuracy: number;
  strategicOutlookUsefulness: number;
  blueprintBriefingClarity: number;
  intelligenceContinuity: number;
  recoveryIntelligence: number;
}

export function evaluateSevenDayJourney(status: SevenDayJourneyStatus): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  if (!status.day0OnboardingComplete) failures.push("day0_onboarding");
  if (status.day1PrimaryLoopMs >= 3000) failures.push("day1_primary_loop_sla");
  if (!status.day3AcademyResumed) failures.push("day3_academy_resume");
  if (!status.day5PsychologyFired) failures.push("day5_psychology");
  if (!status.day6GovernanceApproved) failures.push("day6_governance");
  if (status.day7DashboardPanels < 6) failures.push("day7_dashboard_panels");
  if (!status.activeOrderContinuity) failures.push("active_order_continuity");
  if (status.signalDriftCount !== 0) failures.push("signal_drift");
  return { pass: failures.length === 0, failures };
}

export function evaluatePresenceScore(input: PresenceScoreInput): {
  average: number;
  pass: boolean;
  requiredChecksPass: boolean;
} {
  const scores = Object.values(input);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const requiredChecksPass =
    input.morningReportSpecificity >= 4 &&
    input.taskInstructionRelevance >= 4 &&
    input.strategicOutlookUsefulness >= 4;
  return { average, pass: average >= 3.5 && requiredChecksPass, requiredChecksPass };
}

export function auditAuthorityLanguage(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_OUTPUT_PHRASES.filter((phrase) => lower.includes(phrase.toLowerCase()));
}

export function benchmarkContractQuality(input: {
  contract: string;
  clarityScore?: number;
  fallbackRate?: number;
  confidenceTier?: "HIGH" | "MEDIUM" | "LOW";
  domainSpecificRate?: number;
  schemaPassRate?: number;
}): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if ((input.clarityScore ?? 0.75) < 0.7) reasons.push("clarity_below_threshold");
  if ((input.fallbackRate ?? 0) >= 0.2) reasons.push("fallback_rate_high");
  if ((input.schemaPassRate ?? 1) < 0.95) reasons.push("schema_pass_rate_low");
  if (input.confidenceTier === "LOW") reasons.push("chronic_low_confidence");
  if ((input.domainSpecificRate ?? 0.9) < 0.9) reasons.push("domain_specificity_low");
  return { pass: reasons.length === 0, reasons };
}

export function buildPhase1CompletionCertificate(input: {
  integrationTestsPassed: number;
  presenceScore: number;
  threeLawsViolations: number;
}): string {
  const complete =
    input.integrationTestsPassed >= 12 &&
    input.presenceScore >= 3.5 &&
    input.threeLawsViolations === 0;
  return [
    "TORGIMA · BHUDHI PHASE 1",
    complete ? "PHASE 1 COMPLETE" : "PHASE 1 INCOMPLETE",
    "13 Cursor Prompts · 12 Agents · 37 Prompt Contracts · 151 Tests",
    "Signals are sacred. Blueprints are law. Conditions are enforced.",
  ].join("\n");
}
