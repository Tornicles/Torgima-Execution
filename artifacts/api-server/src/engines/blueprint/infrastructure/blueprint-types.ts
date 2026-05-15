export type BlueprintTier = "starter" | "growth" | "ultimate";
export type BlueprintMode = "individual" | "team";
export type IntelligenceDepth = "guided" | "operational" | "strategic";

export type TeamRole =
  | "owner"
  | "strategist"
  | "operator"
  | "contributor"
  | "reviewer"
  | "observer";

export type BlueprintOperationalState =
  | "ACTIVE"
  | "STALLED"
  | "DEGRADED"
  | "RECOVERY"
  | "COLLAPSED"
  | "ARCHIVED";
