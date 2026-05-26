import type { BhudhiInvestigationFindings, InvestigationSubject } from "@workspace/db/types/bhudhi";

/** Result shape from each investigation engine before persistence. */
export interface EngineFindingResult extends BhudhiInvestigationFindings {
  confidence?: number;
  severity?: "low" | "medium" | "high";
  actionable?: boolean;
}

export const INVESTIGATION_ENGINE_NAMES = [
  "Data Collection Engine",
  "Pattern Discovery Engine",
  "Anomaly Detection Engine",
  "Root Cause Analysis Engine",
  "Comparative Benchmarking Engine",
  "Hidden Insight Engine",
  "System Topology Engine",
  "Vulnerability Assessment Engine",
  "Financial Analysis Engine",
  "Operational Metrics Engine",
  "Competitive Intelligence Engine",
  "Sentiment & Culture Engine",
  "Compliance & Risk Engine",
] as const;

export type InvestigationEngineName = (typeof INVESTIGATION_ENGINE_NAMES)[number];

export function subjectForEngine(engineName: string): InvestigationSubject {
  if (engineName.includes("Data Collection")) return "execution";
  if (engineName.includes("External")) return "external_system";
  if (engineName.includes("Pattern")) return "patterns";
  if (engineName.includes("Anomaly")) return "anomalies";
  if (engineName.includes("Vulnerability") || engineName.includes("Compliance")) return "risks";
  if (engineName.includes("Hidden Insight") || engineName.includes("Opportunity")) return "opportunities";
  if (engineName.includes("Competitive")) return "external_system";
  return "execution";
}
