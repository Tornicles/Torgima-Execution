/**
 * Static catalog for BHUDHI PROMPT 1 seed.
 */
import type { BhudhiSystemId, BhudhiEngineType } from "./types/bhudhi.js";

export const BHUDHI_SYSTEMS: Array<{
  id: BhudhiSystemId;
  name: BhudhiSystemId;
  description: string;
}> = [
  {
    id: "investigation",
    name: "investigation",
    description: "Pattern, anomaly, risk, and execution trace investigation across blueprints.",
  },
  {
    id: "intelligence",
    name: "intelligence",
    description: "Strategic recommendations, reality intelligence, and signal narratives.",
  },
  {
    id: "operating",
    name: "operating",
    description: "Task generation, feedback interpretation, and operational AI triggers.",
  },
  {
    id: "security",
    name: "security",
    description: "Output validation, forbidden modes, credentials, and usage governance.",
  },
  {
    id: "preservation",
    name: "preservation",
    description: "Memory compression, framework learning, and historical preservation.",
  },
];

type EngineSeed = {
  id: string;
  systemId: BhudhiSystemId;
  name: string;
  type: BhudhiEngineType;
  description: string;
};

/** BHUDHI PROMPT 2 — 13 investigation engines (names must match InvestigationService routing). */
const investigationEngines: EngineSeed[] = [
  { id: "inv_data_collection", systemId: "investigation", name: "Data Collection Engine", type: "investigation", description: "Collects execution, feedback, and external data points." },
  { id: "inv_pattern_discovery", systemId: "investigation", name: "Pattern Discovery Engine", type: "investigation", description: "Discovers recurring patterns and correlations." },
  { id: "inv_anomaly_detection", systemId: "investigation", name: "Anomaly Detection Engine", type: "investigation", description: "Statistical anomaly detection on execution metrics." },
  { id: "inv_root_cause", systemId: "investigation", name: "Root Cause Analysis Engine", type: "investigation", description: "Analyzes root causes behind detected anomalies." },
  { id: "inv_benchmarking", systemId: "investigation", name: "Comparative Benchmarking Engine", type: "investigation", description: "Compares blueprint metrics to domain benchmarks." },
  { id: "inv_hidden_insight", systemId: "investigation", name: "Hidden Insight Engine", type: "investigation", description: "Surfaces non-obvious execution insights." },
  { id: "inv_topology", systemId: "investigation", name: "System Topology Engine", type: "investigation", description: "Maps dependencies, critical paths, and bottlenecks." },
  { id: "inv_vulnerability", systemId: "investigation", name: "Vulnerability Assessment Engine", type: "investigation", description: "Assesses operational and integrity vulnerabilities." },
  { id: "inv_financial", systemId: "investigation", name: "Financial Analysis Engine", type: "investigation", description: "Financial runway and margin analysis from blueprint intel." },
  { id: "inv_operational_metrics", systemId: "investigation", name: "Operational Metrics Engine", type: "investigation", description: "Velocity, throughput, quality, and utilization metrics." },
  { id: "inv_competitive", systemId: "investigation", name: "Competitive Intelligence Engine", type: "investigation", description: "Competitive intelligence from validation and Erector data." },
  { id: "inv_sentiment", systemId: "investigation", name: "Sentiment & Culture Engine", type: "investigation", description: "Sentiment and morale signals from feedback reflections." },
  { id: "inv_compliance", systemId: "investigation", name: "Compliance & Risk Engine", type: "investigation", description: "Compliance scoring and classified failure risk." },
];

/** BHUDHI PROMPT 3 — 12 intelligence engines (names match IntelligenceService routing). */
const intelligenceEngines: EngineSeed[] = [
  { id: "int_framework_applicator", systemId: "intelligence", name: "Framework Applicator Engine", type: "intelligence", description: "Applies domain frameworks to investigation findings." },
  { id: "int_contradiction_resolution", systemId: "intelligence", name: "Contradiction Resolution Engine", type: "intelligence", description: "Resolves conflicting framework recommendations." },
  { id: "int_scenario_simulator", systemId: "intelligence", name: "Scenario Simulator Engine", type: "intelligence", description: "Simulates conservative, moderate, and aggressive scenarios." },
  { id: "int_recommendation_engine", systemId: "intelligence", name: "Recommendation Engine", type: "intelligence", description: "Synthesizes actionable recommendations from resolved analysis." },
  { id: "int_impact_analyzer", systemId: "intelligence", name: "Impact Analyzer Engine", type: "intelligence", description: "Quantifies expected revenue, efficiency, risk, and timeline impact." },
  { id: "int_risk_assessment", systemId: "intelligence", name: "Risk Assessment Engine", type: "intelligence", description: "Assesses probability, severity, and mitigation for each recommendation." },
  { id: "int_optimization", systemId: "intelligence", name: "Optimization Engine", type: "intelligence", description: "Optimizes recommendation efficiency and cost." },
  { id: "int_dependency_analyzer", systemId: "intelligence", name: "Dependency Analyzer Engine", type: "intelligence", description: "Maps order dependencies and blockers for recommendations." },
  { id: "int_feasibility", systemId: "intelligence", name: "Feasibility Assessment Engine", type: "intelligence", description: "Scores feasibility, resources, and effort." },
  { id: "int_stakeholder_impact", systemId: "intelligence", name: "Stakeholder Impact Engine", type: "intelligence", description: "Evaluates winners, losers, and adoption likelihood." },
  { id: "int_strategic_alignment", systemId: "intelligence", name: "Strategic Alignment Engine", type: "intelligence", description: "Measures alignment with blueprint goal and constraints." },
  { id: "int_learning_integration", systemId: "intelligence", name: "Learning Integration Engine", type: "intelligence", description: "Integrates validated framework learnings into recommendations." },
];

/** BHUDHI PROMPT 4 — 10 operating engines (names match OperatingService routing). */
const operatingEngines: EngineSeed[] = [
  { id: "op_action_executor", systemId: "operating", name: "Action Executor Engine", type: "operating", description: "Executes approved recommendation changes safely." },
  { id: "op_integration_manager", systemId: "operating", name: "Integration Manager Engine", type: "operating", description: "Syncs execution results to external systems." },
  { id: "op_workflow_orchestrator", systemId: "operating", name: "Workflow Orchestrator Engine", type: "operating", description: "Coordinates multi-step follow-up workflows." },
  { id: "op_change_control", systemId: "operating", name: "Change Control Engine", type: "operating", description: "Approves or rejects changes against policy constraints." },
  { id: "op_gradual_rollout", systemId: "operating", name: "Gradual Rollout Engine", type: "operating", description: "Plans canary and staged rollout phases." },
  { id: "op_error_recovery", systemId: "operating", name: "Error Recovery Engine", type: "operating", description: "Recovers from failed executions via rollback." },
  { id: "op_performance_optimizer", systemId: "operating", name: "Performance Optimizer Engine", type: "operating", description: "Optimizes execution latency and throughput." },
  { id: "op_resource_allocator", systemId: "operating", name: "Resource Allocator Engine", type: "operating", description: "Tracks budget and resource allocation." },
  { id: "op_scheduling", systemId: "operating", name: "Scheduling Engine", type: "operating", description: "Schedules execution in low-disruption windows." },
  { id: "op_compliance_enforcer", systemId: "operating", name: "Compliance Enforcer Engine", type: "operating", description: "Verifies regulatory and audit compliance post-execution." },
];

const securityEngines: EngineSeed[] = [
  { id: "sec_output_validator", systemId: "security", name: "Output Validator Gate", type: "operating", description: "Validates Bhudhi JSON contracts before persistence." },
  { id: "sec_forbidden_mode", systemId: "security", name: "Forbidden Mode Guard", type: "operating", description: "Blocks DECIDE, MUTATE, OVERRIDE modes." },
  { id: "sec_credential_vault", systemId: "security", name: "Credential Vault Guard", type: "operating", description: "Encrypts external connection credentials." },
  { id: "sec_usage_controller", systemId: "security", name: "API Usage Controller", type: "operating", description: "Rate limits and token budgets per user." },
  { id: "sec_contradiction_guard", systemId: "security", name: "Contradiction Guard", type: "operating", description: "Records and escalates intelligence contradictions." },
];

const preservationEngines: EngineSeed[] = [
  { id: "pre_memory_compression", systemId: "preservation", name: "Memory Compression Engine", type: "preservation", description: "Compresses long-running Bhudhi memory threads." },
  { id: "pre_framework_learning", systemId: "preservation", name: "Framework Learning Tracker", type: "preservation", description: "Tracks framework accuracy improvements." },
  { id: "pre_accuracy_calibration", systemId: "preservation", name: "Accuracy Calibration Engine", type: "preservation", description: "Calibrates confidence thresholds from outcomes." },
  { id: "pre_snapshot_preserver", systemId: "preservation", name: "Historical Snapshot Preserver", type: "preservation", description: "Preserves signal and condition snapshots." },
  { id: "pre_self_improvement", systemId: "preservation", name: "Self Improvement Cycle Engine", type: "preservation", description: "Runs self-improvement and compression cycles." },
  { id: "pre_knowledge_archive", systemId: "preservation", name: "Knowledge Artifact Preserver", type: "preservation", description: "Archives knowledge injections and academy artifacts." },
  { id: "pre_external_archive", systemId: "preservation", name: "External Data Archive Engine", type: "preservation", description: "Archives normalized external integration data." },
];

export const BHUDHI_ENGINES: EngineSeed[] = [
  ...investigationEngines,
  ...intelligenceEngines,
  ...operatingEngines,
  ...securityEngines,
  ...preservationEngines,
];

export const BHUDHI_FRAMEWORKS: Array<{
  id: string;
  name: string;
  type: "team" | "individual";
  description: string;
  domains: string[];
  accuracy: number;
}> = [
  { id: "governance_risk", name: "GOVERNANCE_RISK", type: "team", description: "Risk veto and governance overlay.", domains: ["genesis", "market", "delivery", "operations", "growth", "continuity", "people"], accuracy: 0.72 },
  { id: "strategycore", name: "STRATEGYCORE", type: "team", description: "Strategic direction and positioning.", domains: ["genesis", "market", "continuity"], accuracy: 0.68 },
  { id: "synergyops", name: "SYNERGYOPS", type: "team", description: "Operational synergy and handoffs.", domains: ["delivery", "operations"], accuracy: 0.65 },
  { id: "customervalue", name: "CUSTOMERVALUE", type: "team", description: "Customer value and demand alignment.", domains: ["market", "growth", "people"], accuracy: 0.67 },
  { id: "clarity_catalyst", name: "CLARITY_CATALYST", type: "team", description: "Clarity and decision acceleration.", domains: ["genesis", "market"], accuracy: 0.7 },
  { id: "finmatrix", name: "FINMATRIX", type: "team", description: "Financial matrix and unit economics.", domains: ["growth", "continuity"], accuracy: 0.6 },
  { id: "talentsync", name: "TALENTSYNC", type: "team", description: "Talent and capability alignment.", domains: ["people", "operations"], accuracy: 0.58 },
  { id: "alignment_accountability", name: "ALIGNMENT_ACCOUNTABILITY", type: "team", description: "Accountability chains and commitments.", domains: ["genesis", "delivery"], accuracy: 0.62 },
  { id: "omnigrowth", name: "OMNIGROWTH", type: "team", description: "Growth loops and expansion paths.", domains: ["growth", "market"], accuracy: 0.61 },
  { id: "adaptive_intelligence", name: "ADAPTIVE_INTELLIGENCE", type: "team", description: "Adaptive response to signal shifts.", domains: ["operations", "delivery"], accuracy: 0.59 },
  { id: "knowledgeflow", name: "KNOWLEDGEFLOW", type: "team", description: "Knowledge capture and flow.", domains: ["genesis", "people"], accuracy: 0.57 },
  { id: "decision_velocity", name: "DECISION_VELOCITY", type: "team", description: "Decision speed vs quality tradeoffs.", domains: ["market", "growth"], accuracy: 0.56 },
  { id: "regeneration_exit", name: "REGENERATION_EXIT", type: "team", description: "Recovery and graceful exit paths.", domains: ["continuity", "delivery"], accuracy: 0.55 },
  { id: "culture_dynamics", name: "CULTURE_DYNAMICS", type: "team", description: "Culture and team dynamics (Phase 2).", domains: ["people"], accuracy: 0.5 },
  { id: "individual_mastery", name: "INDIVIDUAL_MASTERY", type: "individual", description: "Individual execution mastery overlay.", domains: ["genesis", "delivery", "growth"], accuracy: 0.64 },
];

const DOMAIN_FRAMEWORK_ROLES: Record<string, Record<string, "lead" | "veto" | "advise" | "blocked">> = {
  genesis: { governance_risk: "veto", strategycore: "lead", synergyops: "blocked", customervalue: "blocked", clarity_catalyst: "lead" },
  market: { governance_risk: "veto", strategycore: "advise", synergyops: "blocked", customervalue: "lead", clarity_catalyst: "advise" },
  delivery: { governance_risk: "veto", strategycore: "advise", synergyops: "lead", customervalue: "advise", clarity_catalyst: "blocked" },
  operations: { governance_risk: "veto", strategycore: "advise", synergyops: "lead", customervalue: "blocked", clarity_catalyst: "blocked" },
  growth: { governance_risk: "veto", strategycore: "advise", synergyops: "blocked", customervalue: "lead", clarity_catalyst: "advise" },
  continuity: { governance_risk: "lead", strategycore: "lead", synergyops: "advise", customervalue: "blocked", clarity_catalyst: "blocked" },
  people: { governance_risk: "veto", strategycore: "advise", synergyops: "blocked", customervalue: "lead", clarity_catalyst: "advise" },
};

export const BHUDHI_DOMAINS: Array<{
  id: string;
  name: string;
  description: string;
  activeFrameworks: string[];
  frameworkRoles: Record<string, "lead" | "veto" | "advise" | "blocked">;
}> = [
  { id: "genesis", name: "genesis", description: "Goal clarity, purpose, and blueprint genesis.", activeFrameworks: ["governance_risk", "strategycore", "clarity_catalyst", "individual_mastery"], frameworkRoles: DOMAIN_FRAMEWORK_ROLES.genesis! },
  { id: "market", name: "market", description: "Market positioning, demand, and competitive framing.", activeFrameworks: ["governance_risk", "strategycore", "customervalue", "clarity_catalyst"], frameworkRoles: DOMAIN_FRAMEWORK_ROLES.market! },
  { id: "delivery", name: "delivery", description: "Execution delivery and operational throughput.", activeFrameworks: ["governance_risk", "synergyops", "strategycore", "individual_mastery"], frameworkRoles: DOMAIN_FRAMEWORK_ROLES.delivery! },
  { id: "operations", name: "operations", description: "Systems, processes, and operational infrastructure.", activeFrameworks: ["governance_risk", "synergyops", "adaptive_intelligence"], frameworkRoles: DOMAIN_FRAMEWORK_ROLES.operations! },
  { id: "growth", name: "growth", description: "Growth loops, revenue, and expansion.", activeFrameworks: ["governance_risk", "customervalue", "omnigrowth"], frameworkRoles: DOMAIN_FRAMEWORK_ROLES.growth! },
  { id: "continuity", name: "continuity", description: "Continuity, risk buffers, and long-horizon stability.", activeFrameworks: ["governance_risk", "strategycore", "regeneration_exit"], frameworkRoles: DOMAIN_FRAMEWORK_ROLES.continuity! },
  { id: "people", name: "people", description: "People, talent, and capability systems.", activeFrameworks: ["governance_risk", "customervalue", "talentsync"], frameworkRoles: DOMAIN_FRAMEWORK_ROLES.people! },
];

/** BHUDHI PROMPT 13 — 8 Torgima AI modules (Bhudhi 2.0) */
export const BHUDHI_MODULES: Array<{
  id: string;
  name: string;
  system: BhudhiSystemId;
  description: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  logic: Record<string, unknown>;
  accuracy: number;
}> = [
  { id: "mod_cis", name: "CIS", system: "investigation", description: "Context Intelligence — current domain, phase, resources, constraints.", inputs: { events: true, signals: true }, outputs: { contextState: true }, logic: { version: "2.0" }, accuracy: 0.82 },
  { id: "mod_eis", name: "EIS", system: "investigation", description: "External Intelligence — market, competitors, threats, opportunities.", inputs: { externalData: true }, outputs: { externalAnalysis: true }, logic: { version: "2.0" }, accuracy: 0.78 },
  { id: "mod_bis", name: "BIS", system: "investigation", description: "Behavioral Intelligence — adoption, resistance, motivation, alignment.", inputs: { events: true, signals: true }, outputs: { behaviorProfile: true }, logic: { version: "2.0" }, accuracy: 0.8 },
  { id: "mod_iis", name: "IIS", system: "intelligence", description: "Idea Intelligence — generate and rank strategic alternatives.", inputs: { problem: true }, outputs: { ideaSet: true }, logic: { version: "2.0" }, accuracy: 0.85 },
  { id: "mod_sis", name: "SIS", system: "intelligence", description: "Strategic Intelligence — select winning path via frameworks.", inputs: { options: true, frameworks: true }, outputs: { strategicChoice: true }, logic: { version: "2.0" }, accuracy: 0.83 },
  { id: "mod_pis", name: "PIS", system: "intelligence", description: "Predictive Intelligence — forecast outcomes and risks.", inputs: { recommendation: true }, outputs: { prediction: true }, logic: { version: "2.0" }, accuracy: 0.79 },
  { id: "mod_kis", name: "KIS", system: "intelligence", description: "Knowledge Intelligence — apply validated framework learnings.", inputs: { situation: true }, outputs: { knowledgeRecommendations: true }, logic: { version: "2.0" }, accuracy: 0.81 },
  { id: "mod_riez", name: "RIEZ", system: "operating", description: "Real-Time Industry Execution — executable step plans.", inputs: { recommendation: true }, outputs: { executionPlan: true }, logic: { version: "2.0" }, accuracy: 0.86 },
];
