import type { BhudhiDomainName, DomainConditions } from "./types.js";

export const DOMAIN_DESCRIPTIONS: Record<BhudhiDomainName, string> = {
  genesis: "Idea creation and validation phase",
  market: "Customer demand testing and market fit",
  delivery: "Building and executing product",
  operations: "Stabilizing and optimizing execution",
  growth: "Scaling and expanding operations",
  continuity: "Managing crisis and recovery",
  people: "Team development and culture",
};

export const DOMAIN_CONDITIONS: Record<BhudhiDomainName, DomainConditions> = {
  genesis: {
    entry: "Idea is nascent",
    exit: "Concept is validated and market is identified",
    frameworks: 5,
  },
  market: {
    entry: "Concept validated",
    exit: "Market fit achieved, ready to scale delivery",
    frameworks: 6,
  },
  delivery: {
    entry: "Market fit achieved",
    exit: "Product stable, ready for operations",
    frameworks: 7,
  },
  operations: {
    entry: "Product is stable",
    exit: "Processes optimized, ready to grow",
    frameworks: 7,
  },
  growth: {
    entry: "Efficient operations",
    exit: "Scaling challenges emerge",
    frameworks: 7,
  },
  continuity: {
    entry: "Crisis detected",
    exit: "Recovery complete or exit executed",
    frameworks: 7,
  },
  people: {
    entry: "Always active",
    exit: "Organization dissolved",
    frameworks: 6,
  },
};

export function getDomainDescription(domain: string): string {
  return DOMAIN_DESCRIPTIONS[domain as BhudhiDomainName] ?? "Unknown domain";
}

export function getDomainConditions(domain: string): DomainConditions {
  return DOMAIN_CONDITIONS[domain as BhudhiDomainName] ?? { entry: "", exit: "", frameworks: 0 };
}

/** Resolve maturity-based domain from execution volume (BHUDHI PROMPT 7). */
export function resolveDomainFromEventCount(
  totalEvents: number,
  globalSignal?: string,
): BhudhiDomainName {
  if (totalEvents === 0) return "genesis";
  if (totalEvents < 5) return "genesis";
  if (totalEvents < 15) return "market";
  if (totalEvents < 40) return "delivery";
  if (totalEvents < 80) return "operations";
  if (totalEvents < 150) return "growth";
  if (globalSignal === "danger" || globalSignal === "urgency") return "continuity";
  return "growth";
}
