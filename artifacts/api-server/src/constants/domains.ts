// Execution domains — the 7 high-level execution arenas. The Phase 1 status
// gate determines whether a transition into a domain is allowed today.
//
// Spec: Prompt 1 §constants/domains. Mirrors the `domain` Postgres enum.

export const DOMAINS = {
  GENESIS:    "genesis",
  MARKET:     "market",
  DELIVERY:   "delivery",
  CONTINUITY: "continuity",
  OPERATIONS: "operations",
  GROWTH:     "growth",
  PEOPLE:     "people",
} as const;

export type Domain = (typeof DOMAINS)[keyof typeof DOMAINS];

export const DOMAIN_LABELS: Record<Domain, string> = {
  genesis:    "Genesis — Building from zero",
  market:     "Market — Revenue and growth",
  delivery:   "Delivery — Output and completion",
  operations: "Operations — Process and systems",
  people:     "People — Team and culture",
  growth:     "Growth — Scale and expansion",
  continuity: "Continuity — Habits and consistency",
};

export type DomainPhase1Status =
  | "always_active"
  | "active"
  | "limited"
  | "disabled";

// Phase 1 activation rules:
//   genesis    → always_active (the default fallback domain)
//   market, delivery, continuity → active (full execution allowed)
//   operations → limited (allowed but constrained)
//   growth, people → disabled (transitions blocked; redirects to genesis)
export const DOMAIN_PHASE1_STATUS: Record<Domain, DomainPhase1Status> = {
  genesis:    "always_active",
  market:     "active",
  delivery:   "active",
  continuity: "active",
  operations: "limited",
  growth:     "disabled",
  people:     "disabled",
};

export const PHASE_1_ACTIVE_DOMAINS: readonly Domain[] = [
  "genesis",
  "market",
  "delivery",
  "continuity",
];

export const DEFAULT_DOMAIN: Domain = "genesis";
