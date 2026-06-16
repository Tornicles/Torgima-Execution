/**
 * DOC25 — friction type catalog, severity ordering, and shared types.
 */

export const DOC25_FRICTION_TYPES = [
  "CLARITY_FRICTION",
  "SIZE_FRICTION",
  "DIFFICULTY_FRICTION",
  "TIMING_FRICTION",
  "DEPENDENCY_FRICTION",
  "COGNITIVE_FRICTION",
  "EMOTIONAL_FRICTION",
  "SYSTEM_FRICTION",
  "OUTCOME_FRICTION",
] as const;

/** IL4 / Phase 5 legacy labels retained for catalog compatibility. */
export const LEGACY_FRICTION_TYPES = ["TIME_FRICTION", "MOTIVATION_FRICTION"] as const;

export const FRICTION_TYPES = [...DOC25_FRICTION_TYPES, ...LEGACY_FRICTION_TYPES] as const;

export type Doc25FrictionType = (typeof DOC25_FRICTION_TYPES)[number];
export type FrictionType = (typeof FRICTION_TYPES)[number];

export type FrictionSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FrictionConfidence = "LOW" | "MEDIUM" | "HIGH";

export const SEVERITY_ORDER: Record<FrictionSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const CONFIDENCE_ORDER: Record<FrictionConfidence, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export type DetectedFriction = {
  type: Doc25FrictionType;
  severity: FrictionSeverity;
  confidence: FrictionConfidence;
  reason: string;
};

export type FrictionContext = {
  userId: string;
  blueprintId: string;
  feedbackId?: string;
  orderId?: string;
  trigger?: string;
};

export type FrictionDetectionResult = {
  detected: DetectedFriction[];
  primary: DetectedFriction | null;
  adaptationRouted: boolean;
  adaptationEvent?: string;
  rootCauseReview?: boolean;
};
