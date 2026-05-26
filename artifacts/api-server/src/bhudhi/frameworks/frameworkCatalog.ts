import type { FrameworkCatalogEntry } from "./types.js";

/** Canonical catalog for DB initialize (14 team + individual). */
export const FRAMEWORK_CATALOG: FrameworkCatalogEntry[] = [
  { id: "strategycore", name: "STRATEGYCORE", type: "team", description: "Strategic direction and choice", domains: ["genesis", "market", "growth"], role: "lead" },
  { id: "omnigrowth", name: "OMNIGROWTH", type: "team", description: "Demand, conversion, revenue intelligence", domains: ["market", "growth"], role: "lead" },
  { id: "customervalue", name: "CUSTOMERVALUE", type: "team", description: "Value delivery, experience, trust", domains: ["market", "delivery"], role: "lead" },
  { id: "finmatrix", name: "FINMATRIX", type: "team", description: "Capital intelligence, allocation, survival", domains: ["operations", "growth", "continuity"], role: "advise" },
  { id: "synergyops", name: "SYNERGYOPS", type: "team", description: "Execution flow, stability, throughput", domains: ["delivery", "operations"], role: "lead" },
  { id: "talentsync", name: "TALENTSYNC", type: "team", description: "Human capability, leadership, resilience", domains: ["people", "operations", "growth"], role: "lead" },
  { id: "culture_dynamics", name: "CULTURE_DYNAMICS", type: "team", description: "Behavioral control, norm enforcement", domains: ["people", "operations"], role: "advise", status: "active" },
  { id: "alignment_accountability", name: "ALIGNMENT_ACCOUNTABILITY", type: "team", description: "Power clarity, incentive integrity, ownership", domains: ["genesis", "delivery", "operations"], role: "veto" },
  { id: "clarity_catalyst", name: "CLARITY_CATALYST", type: "team", description: "Remove confusion, resolve contradictions", domains: ["genesis", "market"], role: "lead" },
  { id: "governance_risk", name: "GOVERNANCE_RISK", type: "team", description: "Control, exposure, survival", domains: ["operations", "continuity"], role: "veto" },
  { id: "knowledgeflow", name: "KNOWLEDGEFLOW", type: "team", description: "Organizational memory, learning velocity", domains: ["operations", "people"], role: "advise" },
  { id: "decision_velocity", name: "DECISION_VELOCITY", type: "team", description: "Decision speed, quality, load", domains: ["delivery", "operations", "growth"], role: "advise" },
  { id: "adaptive_intelligence", name: "ADAPTIVE_INTELLIGENCE", type: "team", description: "Environmental sensing, change response", domains: ["continuity"], role: "advise" },
  { id: "regeneration_exit", name: "REGENERATION_EXIT", type: "team", description: "Renewal, reset, strategic exit", domains: ["continuity"], role: "advise" },
  { id: "individual_mastery", name: "INDIVIDUAL_MASTERY", type: "individual", description: "Personal strategy: winning definition, focus arena, resource reality, path to victory", domains: ["genesis"], role: "lead" },
];
