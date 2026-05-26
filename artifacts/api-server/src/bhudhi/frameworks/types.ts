import type { BhudhiInvestigation, GlobalSignal } from "@workspace/db/types/bhudhi";

export type FrameworkRole = "lead" | "veto" | "advise" | "blocked";

export interface PersonalStrategyComponents {
  winningDefinition: string;
  focusArena: string;
  resourceReality: string;
  pathToVictory: string;
}

export interface FrameworkEvaluationResult {
  signal: GlobalSignal;
  confidence: number;
  insights: string[];
  recommendation: string;
  domains: string[];
  role: FrameworkRole;
  components?: PersonalStrategyComponents;
}

export type InvestigationInput = BhudhiInvestigation[];

export interface FrameworkCatalogEntry {
  id: string;
  name: string;
  type: "team" | "individual";
  description: string;
  domains: string[];
  role: FrameworkRole;
  status?: "active" | "inactive";
}
