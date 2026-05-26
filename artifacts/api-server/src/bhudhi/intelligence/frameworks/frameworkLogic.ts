/**
 * Framework evaluation logic — one evaluator per team/individual framework.
 */
import type { GlobalSignal } from "@workspace/db/types/bhudhi";
import type { FrameworkEvaluation, InvestigationInput } from "../types.js";

export type FrameworkEvaluator = (investigations: InvestigationInput) => Omit<FrameworkEvaluation, "frameworkId" | "framework">;

function insightText(investigations: InvestigationInput): string {
  return investigations.flatMap((i) => i.findings.insights ?? []).join(" ").toLowerCase();
}

function anomalyCount(investigations: InvestigationInput): number {
  return investigations.reduce((n, i) => n + (i.findings.anomalies?.length ?? 0), 0);
}

function hasInsight(investigations: InvestigationInput, ...needles: string[]): boolean {
  const text = insightText(investigations);
  return needles.some((n) => text.includes(n.toLowerCase()));
}

function baseEval(
  signal: GlobalSignal,
  confidence: number,
  insights: string[],
  recommendation: string | null,
): Omit<FrameworkEvaluation, "frameworkId" | "framework"> {
  return { signal, confidence, insights, recommendation };
}

export function evaluateStrategycore(investigations: InvestigationInput) {
  const clear =
    hasInsight(investigations, "strategy", "strategic", "direction") ||
    investigations.some((i) => i.subject === "execution" && i.confidence >= 0.7);
  return baseEval(
    clear ? "stability" : "urgency",
    0.8,
    [clear ? "Strategy is clear and defensible" : "Strategy needs clarification"],
    clear ? "Continue strategic direction" : "Clarify strategy immediately",
  );
}

export function evaluateOmnigrowth(investigations: InvestigationInput) {
  const growth = hasInsight(investigations, "growth", "opportunity", "scale", "gap");
  return baseEval(
    growth ? "power" : "nothingness",
    growth ? 0.85 : 0.55,
    [growth ? "Growth opportunity identified" : "Growth signals not yet visible"],
    growth ? "Scale customer acquisition" : null,
  );
}

export function evaluateCustomervalue(investigations: InvestigationInput) {
  const retention = hasInsight(investigations, "customer", "feedback", "sentiment", "value");
  return baseEval(
    retention ? "affluence" : "urgency",
    retention ? 0.9 : 0.6,
    [retention ? "Customer value validated" : "Customer loop needs strengthening"],
    retention ? "Focus on retention" : "Rebuild customer feedback loop",
  );
}

export function evaluateSynergyops(investigations: InvestigationInput) {
  const smooth = anomalyCount(investigations) < 2;
  return baseEval(
    smooth ? "power" : "danger",
    smooth ? 0.75 : 0.65,
    [smooth ? "Execution smooth" : "Operational friction detected"],
    smooth ? "Maintain operational efficiency" : "Reduce dependency bottlenecks",
  );
}

export function evaluateGovernanceRisk(investigations: InvestigationInput) {
  const riskHigh = investigations.some((i) => i.severity === "high") || anomalyCount(investigations) >= 3;
  return baseEval(
    riskHigh ? "danger" : "stability",
    0.72,
    [riskHigh ? "Governance risk elevated" : "Risk within acceptable bounds"],
    riskHigh ? "Pause expansion until risks mitigated" : null,
  );
}

export function evaluateClarityCatalyst(investigations: InvestigationInput) {
  const vague = hasInsight(investigations, "clarify", "unclear", "silent completion");
  return baseEval(
    vague ? "urgency" : "stability",
    0.7,
    [vague ? "Decision clarity needed" : "Decisions are traceable"],
    vague ? "Run clarity session on next 3 orders" : "Accelerate highest-value order",
  );
}

export function evaluateFinmatrix(investigations: InvestigationInput) {
  const financial = hasInsight(investigations, "revenue", "burn", "runway", "margin");
  return baseEval(
    financial ? "affluence" : "nothingness",
    0.6,
    [financial ? "Financial signals present" : "Financial data sparse — use intel metadata"],
    financial ? "Tighten unit economics on core offer" : null,
  );
}

export function evaluateTalentsync(investigations: InvestigationInput) {
  const people = hasInsight(investigations, "morale", "sentiment", "friction", "burnout");
  return baseEval(
    people ? "urgency" : "power",
    0.58,
    [people ? "People/capability strain detected" : "Capability alignment stable"],
    people ? "Reduce load or add capability support" : null,
  );
}

export function evaluateAlignmentAccountability(investigations: InvestigationInput) {
  const gap = hasInsight(investigations, "feedback rate", "missing feedback", "compliance");
  return baseEval(
    gap ? "urgency" : "stability",
    0.62,
    [gap ? "Accountability gap in feedback loop" : "Commitments tracked"],
    gap ? "Enforce feedback within 2 hours of completion" : "Maintain accountability cadence",
  );
}

export function evaluateAdaptiveIntelligence(investigations: InvestigationInput) {
  const drift = hasInsight(investigations, "drift", "anomaly", "pattern");
  return baseEval(
    drift ? "powerchange" : "stability",
    0.59,
    [drift ? "Signal/execution drift requires adaptation" : "System adapting within norms"],
    drift ? "Recalibrate enforcement package" : null,
  );
}

export function evaluateKnowledgeflow(investigations: InvestigationInput) {
  const knowledge = hasInsight(investigations, "knowledge", "insight", "pattern");
  return baseEval(
    knowledge ? "power" : "nothingness",
    0.57,
    [knowledge ? "Knowledge artifacts flowing" : "Knowledge capture thin"],
    knowledge ? "Inject SOP into next order chain" : "Document last completed order learnings",
  );
}

export function evaluateDecisionVelocity(investigations: InvestigationInput) {
  const slow = hasInsight(investigations, "blocked", "bottleneck", "dependency");
  return baseEval(
    slow ? "urgency" : "power",
    0.56,
    [slow ? "Decision velocity constrained by blockers" : "Decision velocity acceptable"],
    slow ? "Clear top blocker on critical path" : null,
  );
}

export function evaluateRegenerationExit(investigations: InvestigationInput) {
  const recovery = hasInsight(investigations, "recovery", "vulnerability", "gaming", "false progress");
  return baseEval(
    recovery ? "danger" : "stability",
    0.55,
    [recovery ? "Recovery or exit path may be needed" : "No recovery trigger"],
    recovery ? "Activate recovery sequence" : null,
  );
}

export function evaluateCultureDynamics(investigations: InvestigationInput) {
  const culture = hasInsight(investigations, "morale", "sentiment", "culture");
  return baseEval(
    culture ? "powerchange" : "stability",
    0.5,
    [culture ? "Culture dynamics need attention" : "Culture signals neutral"],
    culture ? "Review team rituals and communication norms" : null,
  );
}

export function evaluateIndividualMastery(investigations: InvestigationInput) {
  const mastery = investigations.filter((i) => i.subject === "execution").length >= 2;
  return baseEval(
    mastery ? "power" : "nothingness",
    0.64,
    [mastery ? "Individual execution mastery signals present" : "Build execution baseline first"],
    mastery ? "Increase difficulty on proof-bearing orders" : "Complete 3 proof-linked orders",
  );
}

const EVALUATORS: Record<string, FrameworkEvaluator> = {
  STRATEGYCORE: evaluateStrategycore,
  OMNIGROWTH: evaluateOmnigrowth,
  CUSTOMERVALUE: evaluateCustomervalue,
  SYNERGYOPS: evaluateSynergyops,
  GOVERNANCE_RISK: evaluateGovernanceRisk,
  CLARITY_CATALYST: evaluateClarityCatalyst,
  FINMATRIX: evaluateFinmatrix,
  TALENTSYNC: evaluateTalentsync,
  ALIGNMENT_ACCOUNTABILITY: evaluateAlignmentAccountability,
  ADAPTIVE_INTELLIGENCE: evaluateAdaptiveIntelligence,
  KNOWLEDGEFLOW: evaluateKnowledgeflow,
  DECISION_VELOCITY: evaluateDecisionVelocity,
  REGENERATION_EXIT: evaluateRegenerationExit,
  CULTURE_DYNAMICS: evaluateCultureDynamics,
  INDIVIDUAL_MASTERY: evaluateIndividualMastery,
};

export function evaluateFramework(
  frameworkName: string,
  frameworkId: string,
  investigations: InvestigationInput,
): FrameworkEvaluation {
  const fn = EVALUATORS[frameworkName];
  const result = fn
    ? fn(investigations)
    : baseEval("stability", 0.5, ["Framework evaluator not specialized"], null);
  return {
    frameworkId,
    framework: frameworkName,
    ...result,
  };
}
