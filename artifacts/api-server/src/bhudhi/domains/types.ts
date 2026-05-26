import type { FrameworkRole } from "../frameworks/types.js";

export type BhudhiDomainName =
  | "genesis"
  | "market"
  | "delivery"
  | "operations"
  | "growth"
  | "continuity"
  | "people";

export interface DomainCatalogEntry {
  id: BhudhiDomainName;
  name: BhudhiDomainName;
  description: string;
  activeFrameworks: string[];
  frameworkRoles: Record<string, FrameworkRole>;
}

export interface DomainConditions {
  entry: string;
  exit: string;
  frameworks: number;
}

export interface DomainFrameworkView {
  id: string;
  name: string;
  type: string;
  description: string;
  role: FrameworkRole;
  accuracy: number;
}

export interface DomainTransitionCheck {
  transition: boolean;
  newDomain: BhudhiDomainName;
}

export interface DomainTransitionResult {
  success: boolean;
  newDomain: BhudhiDomainName;
  activeFrameworks: DomainFrameworkView[];
}
