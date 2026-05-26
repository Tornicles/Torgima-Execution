/**
 * BHUDHI PROMPT 6 — Full evaluation logic for 14 team frameworks.
 */
import type { FrameworkEvaluationResult, InvestigationInput } from "./types.js";
import { adjustConfidence, anomalyCount, hasInsight } from "./investigationHelpers.js";

type EvalFn = (investigations: InvestigationInput) => FrameworkEvaluationResult;

const strategycoreLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "strategy", "direction", "clear") ? "stability" : "urgency",
  confidence: adjustConfidence(0.85, inv),
  insights: [
    hasInsight(inv, "strategy") ? "Strategic direction is clear" : "Strategic direction needs reinforcement",
    "Vision should be communicated each phase",
    "Goals must stay aligned with strategy",
  ],
  recommendation: "Continue strategic direction with quarterly reviews",
  domains: ["genesis", "market", "growth"],
  role: "lead",
});

const omnigrowthLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "growth", "opportunity", "scale") ? "power" : anomalyCount(inv) > 2 ? "danger" : "urgency",
  confidence: adjustConfidence(0.88, inv),
  insights: [
    "Customer acquisition efficiency is a primary lever",
    hasInsight(inv, "gap") ? "Benchmark gaps indicate conversion upside" : "Conversion rate trajectory needs monitoring",
    "Revenue trajectory should be validated weekly",
  ],
  recommendation: "Scale customer acquisition channels",
  domains: ["market", "growth"],
  role: "lead",
});

const customervalueLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "customer", "sentiment", "satisfaction") ? "affluence" : "urgency",
  confidence: adjustConfidence(0.82, inv),
  insights: [
    "Customer satisfaction signals drive retention",
    hasInsight(inv, "feedback") ? "NPS/feedback loop is active" : "Feedback loop needs strengthening",
    "Retention rate stability protects compounding",
  ],
  recommendation: "Focus on deepening customer relationships",
  domains: ["market", "delivery"],
  role: "lead",
});

const finmatrixLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "runway", "revenue", "burn") ? "stability" : "danger",
  confidence: adjustConfidence(0.9, inv),
  insights: [
    hasInsight(inv, "runway") ? "Cash runway is healthy" : "Cash runway data should be refreshed",
    "Burn rate must stay controlled during scale",
    "Unit economics should be validated per offer",
  ],
  recommendation: "Maintain financial discipline while scaling",
  domains: ["operations", "growth", "continuity"],
  role: "advise",
});

const synergyopsLogic: EvalFn = (inv) => ({
  signal: anomalyCount(inv) < 2 ? "power" : "urgency",
  confidence: adjustConfidence(0.8, inv),
  insights: [
    "Team velocity correlates with dependency health",
    hasInsight(inv, "throughput") ? "Throughput is within target band" : "Throughput should be measured daily",
    hasInsight(inv, "bottleneck") ? "Bottlenecks identified — resolve on critical path" : "No critical bottlenecks flagged",
  ],
  recommendation: "Maintain execution flow while monitoring capacity",
  domains: ["delivery", "operations"],
  role: "lead",
});

const talentsyncLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "morale", "capability", "people") ? "power" : "urgency",
  confidence: adjustConfidence(0.78, inv),
  insights: [
    "Team capability must match blueprint difficulty",
    "Leadership pipeline reduces execution risk",
    hasInsight(inv, "friction") ? "Friction signals — add capability support" : "Morale indicators are acceptable",
  ],
  recommendation: "Invest in professional development",
  domains: ["people", "operations", "growth"],
  role: "lead",
});

const culturedynamicsLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "gaming", "culture") ? "danger" : "stability",
  confidence: adjustConfidence(0.8, inv),
  insights: [
    "Cultural norms must be enforced through proof obligations",
    "Values show up in feedback quality",
    hasInsight(inv, "shallow") ? "Shallow reflections indicate norm drift" : "Behavioral standards are holding",
  ],
  recommendation: "Protect culture as you scale",
  domains: ["people", "operations"],
  role: "advise",
});

const alignmentLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "feedback", "compliance", "accountability") ? "stability" : "urgency",
  confidence: adjustConfidence(0.85, inv),
  insights: [
    "Roles must stay explicit per order chain",
    "Responsibilities map to proof requirements",
    hasInsight(inv, "missing feedback") ? "Ownership gap — feedback not closing loop" : "Ownership is assigned and tracked",
  ],
  recommendation: "Maintain clarity as organization grows",
  domains: ["genesis", "delivery", "operations"],
  role: "veto",
});

const clarityLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "confusion", "clarify", "unclear") ? "urgency" : "stability",
  confidence: adjustConfidence(0.75, inv),
  insights: [
    hasInsight(inv, "confusion") ? "Confusion detected in execution copy" : "Confusion level is low",
    "Decisions must be communicated with done-criteria",
    "Direction should be restated each phase transition",
  ],
  recommendation: "Continue clarity initiatives",
  domains: ["genesis", "market"],
  role: "lead",
});

const governanceLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "risk", "compliance", "vulnerability") ? "danger" : "stability",
  confidence: adjustConfidence(0.88, inv),
  insights: [
    hasInsight(inv, "compliance") ? "Compliance posture is documented" : "Compliance review recommended",
    "Risks must be logged when severity is medium+",
    "Controls effective when gaming flags are zero",
  ],
  recommendation: "Strengthen governance as complexity grows",
  domains: ["operations", "continuity"],
  role: "veto",
});

const knowledgeflowLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "knowledge", "learning", "pattern") ? "power" : "stability",
  confidence: adjustConfidence(0.7, inv),
  insights: [
    "Knowledge should be captured after each completed order",
    hasInsight(inv, "insight") ? "Learning velocity is visible in investigations" : "Learning velocity needs baseline",
    "Expertise must be shared via SOP injection",
  ],
  recommendation: "Build knowledge management systems",
  domains: ["operations", "people"],
  role: "advise",
});

const decisionvelocityLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "blocked", "bottleneck") ? "urgency" : "power",
  confidence: adjustConfidence(0.8, inv),
  insights: [
    hasInsight(inv, "blocked") ? "Decision latency from blocked orders" : "Decisions are flowing",
    "Quality maintained when proof gates are clear",
    "Reversible decisions should stay at operator level",
  ],
  recommendation: "Empower quick decisions at all levels",
  domains: ["delivery", "operations", "growth"],
  role: "advise",
});

const adaptiveLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "drift", "anomaly", "pattern") ? "powerchange" : "stability",
  confidence: adjustConfidence(0.72, inv),
  insights: [
    hasInsight(inv, "pattern") ? "Environmental shift detected in patterns" : "Market changes need explicit monitoring",
    "Team response time should be tracked",
    "Flexibility preserved when enforcement packages adapt",
  ],
  recommendation: "Build feedback loops for early detection",
  domains: ["continuity"],
  role: "advise",
});

const regenerationLogic: EvalFn = (inv) => ({
  signal: hasInsight(inv, "recovery", "vulnerability", "gaming") ? "danger" : "stability",
  confidence: adjustConfidence(0.65, inv),
  insights: [
    hasInsight(inv, "recovery") ? "Recovery path available" : "Renewal capability should be defined",
    "Exit options preserved when risk rises",
    "Resilience built through regeneration_exit enforcement",
  ],
  recommendation: "Maintain options for strategic renewal",
  domains: ["continuity"],
  role: "advise",
});

export const TEAM_FRAMEWORK_EVALUATORS: Record<string, EvalFn> = {
  STRATEGYCORE: strategycoreLogic,
  OMNIGROWTH: omnigrowthLogic,
  CUSTOMERVALUE: customervalueLogic,
  FINMATRIX: finmatrixLogic,
  SYNERGYOPS: synergyopsLogic,
  TALENTSYNC: talentsyncLogic,
  CULTURE_DYNAMICS: culturedynamicsLogic,
  ALIGNMENT_ACCOUNTABILITY: alignmentLogic,
  CLARITY_CATALYST: clarityLogic,
  GOVERNANCE_RISK: governanceLogic,
  KNOWLEDGEFLOW: knowledgeflowLogic,
  DECISION_VELOCITY: decisionvelocityLogic,
  ADAPTIVE_INTELLIGENCE: adaptiveLogic,
  REGENERATION_EXIT: regenerationLogic,
};
