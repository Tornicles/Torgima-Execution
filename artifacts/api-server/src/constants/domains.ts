export const DOMAINS = {
  GENESIS: "genesis",
  MARKET: "market",
  DELIVERY: "delivery",
  CONTINUITY: "continuity",
  IDENTITY: "identity",
  CAPABILITY: "capability",
} as const;

export type Domain = (typeof DOMAINS)[keyof typeof DOMAINS];

export const DOMAIN_LABELS: Record<Domain, string> = {
  genesis: "Genesis — Building from zero",
  market: "Market — Revenue and growth",
  delivery: "Delivery — Output and completion",
  continuity: "Continuity — Habits and consistency",
  identity: "Identity — Who you are becoming",
  capability: "Capability — Skills and systems",
};

export const PHASE_1_ACTIVE_DOMAINS: Domain[] = [
  "genesis",
  "market",
  "delivery",
  "continuity",
];
