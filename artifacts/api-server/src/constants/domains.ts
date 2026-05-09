export const DOMAINS = {
  GENESIS: "genesis",
  MARKET: "market",
  DELIVERY: "delivery",
  OPERATIONS: "operations",
  PEOPLE: "people",
  GROWTH: "growth",
  CONTINUITY: "continuity",
} as const;

export type Domain = (typeof DOMAINS)[keyof typeof DOMAINS];

export const DOMAIN_LABELS: Record<Domain, string> = {
  genesis: "Genesis — Building from zero",
  market: "Market — Revenue and growth",
  delivery: "Delivery — Output and completion",
  operations: "Operations — Process and systems",
  people: "People — Team and culture",
  growth: "Growth — Scale and expansion",
  continuity: "Continuity — Habits and consistency",
};

export type DomainPhase1Status = "active" | "limited" | "disabled";

export const DOMAIN_PHASE1_STATUS: Record<Domain, DomainPhase1Status> = {
  genesis: "active",
  market: "active",
  delivery: "active",
  continuity: "active",
  operations: "limited",
  growth: "disabled",
  people: "disabled",
};

export const PHASE_1_ACTIVE_DOMAINS: Domain[] = [
  "genesis",
  "market",
  "delivery",
  "continuity",
];

export const DEFAULT_DOMAIN: Domain = "genesis";
