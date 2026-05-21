// SINGLE SOURCE OF TRUTH for system state values.
// Database enums, API responses, services, and frontend checks should import these constants.

export const BlueprintStatus = {
  DRAFT: "draft",
  VALIDATING: "validating",
  AWAITING_SELECTION: "awaiting_selection",
  PATH_SELECTION: "path_selection",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETE: "complete",
  ABANDONED: "abandoned",
} as const;
export type BlueprintStatus = typeof BlueprintStatus[keyof typeof BlueprintStatus];
export const BlueprintStatusValues = Object.values(BlueprintStatus) as [BlueprintStatus, ...BlueprintStatus[]];

export const ValidationStatus = {
  PENDING: "pending",
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETE: "complete",
  FAILED: "failed",
} as const;
export type ValidationStatus = typeof ValidationStatus[keyof typeof ValidationStatus];
export const ValidationStatusValues = Object.values(ValidationStatus) as [ValidationStatus, ...ValidationStatus[]];

export const ValidationKind = {
  LEGACY: "legacy",
  INTELLIGENCE: "intelligence",
  ERECTOR: "erector",
  READINESS: "readiness",
  PATH_SELECTION: "path_selection",
  UNKNOWN: "unknown",
} as const;
export type ValidationKind = typeof ValidationKind[keyof typeof ValidationKind];
export const ValidationKindValues = Object.values(ValidationKind) as [ValidationKind, ...ValidationKind[]];

/** Erector blueprint tier recommendation (validation output). */
export const BlueprintLevel = {
  STARTER: "starter",
  GROWTH: "growth",
  ULTIMATE: "ultimate",
} as const;
export type BlueprintLevel = typeof BlueprintLevel[keyof typeof BlueprintLevel];
export const BlueprintLevelValues = Object.values(BlueprintLevel) as [BlueprintLevel, ...BlueprintLevel[]];

/** Erector validation run lifecycle (stored on validations.erector_validation_stage when present). */
export const ErectorValidationStage = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETE: "complete",
  FAILED: "failed",
} as const;
export type ErectorValidationStage = typeof ErectorValidationStage[keyof typeof ErectorValidationStage];
export const ErectorValidationStageValues = Object.values(ErectorValidationStage) as [
  ErectorValidationStage,
  ...ErectorValidationStage[],
];

export const OrderStatus = {
  PENDING: "pending",
  ACTIVE: "active",
  PAUSED: "paused",
  BLOCKED: "blocked",
  NEEDS_FEEDBACK: "needs_feedback",
  NEEDS_PROOF: "needs_proof",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
  PRE_GENERATED: "pre_generated",
} as const;
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];
export const OrderStatusValues = Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]];

export const ApiOrderStatus = {
  QUEUED: "queued",
  ACTIVE: "active",
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  BLOCKED: "blocked",
  COMPLETE: "complete",
  CANCELLED: "cancelled",
} as const;
export type ApiOrderStatus = typeof ApiOrderStatus[keyof typeof ApiOrderStatus];
export const ApiOrderStatusValues = Object.values(ApiOrderStatus) as [ApiOrderStatus, ...ApiOrderStatus[]];

export const ConditionState = {
  NOTHINGNESS: "nothingness",
  DANGER: "danger",
  URGENCY: "urgency",
  STABILITY: "stability",
  POWER: "power",
  AFFLUENCE: "affluence",
  POWER_CHANGE: "power_change",
} as const;
export type ConditionState = typeof ConditionState[keyof typeof ConditionState];
export const ConditionStateValues = Object.values(ConditionState) as [ConditionState, ...ConditionState[]];

export const PhaseStatus = {
  PENDING: "pending",
  ACTIVE: "active",
  GATED: "gated",
  BLOCKED: "blocked",
  COMPLETE: "complete",
  SKIPPED: "skipped",
} as const;
export type PhaseStatus = typeof PhaseStatus[keyof typeof PhaseStatus];
export const PhaseStatusValues = Object.values(PhaseStatus) as [PhaseStatus, ...PhaseStatus[]];

export const PlanStatus = {
  PENDING: "pending",
  ACTIVE: "active",
  COMPLETE: "complete",
  SKIPPED: "skipped",
} as const;
export type PlanStatus = typeof PlanStatus[keyof typeof PlanStatus];
export const PlanStatusValues = Object.values(PlanStatus) as [PlanStatus, ...PlanStatus[]];

export const ProjectStatus = {
  PENDING: "pending",
  ACTIVE: "active",
  BLOCKED: "blocked",
  COMPLETE: "complete",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;
export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];
export const ProjectStatusValues = Object.values(ProjectStatus) as [ProjectStatus, ...ProjectStatus[]];

export const TargetStatus = {
  PENDING: "pending",
  ACTIVE: "active",
  ON_TRACK: "on_track",
  AT_RISK: "at_risk",
  COMPLETE: "complete",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;
export type TargetStatus = typeof TargetStatus[keyof typeof TargetStatus];
export const TargetStatusValues = Object.values(TargetStatus) as [TargetStatus, ...TargetStatus[]];

export const ActionType = {
  CREATE: "create",
  REPLICATE: "replicate",
  ANALYZE: "analyze",
  IMPROVE: "improve",
  STANDARDIZE: "standardize",
  RECOVER: "recover",
  TEST: "test",
  PUBLISH: "publish",
  VALIDATE: "validate",
  MEASURE: "measure",
  BUILD: "build",
} as const;
export type ActionType = typeof ActionType[keyof typeof ActionType];
export const ActionTypeValues = Object.values(ActionType) as [ActionType, ...ActionType[]];

export const EventStatus = {
  PENDING: "pending",
  CLAIMED: "claimed",
  PROCESSED: "processed",
  RETRY_PENDING: "retry_pending",
  DEAD_LETTERED: "dead_lettered",
  CANCELLED: "cancelled",
} as const;
export type EventStatus = typeof EventStatus[keyof typeof EventStatus];
export const EventStatusValues = Object.values(EventStatus) as [EventStatus, ...EventStatus[]];

export const PivotReviewStatus = {
  OPEN: "open",
  RESOLVED: "resolved",
  DISMISSED: "dismissed",
} as const;
export type PivotReviewStatus = typeof PivotReviewStatus[keyof typeof PivotReviewStatus];

export const SystemHealthStatus = {
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  CRITICAL: "critical",
  RECOVERING: "recovering",
} as const;
export type SystemHealthStatus = typeof SystemHealthStatus[keyof typeof SystemHealthStatus];

export const NotificationStatus = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  DEFERRED: "deferred",
  SUPPRESSED: "suppressed",
} as const;
export type NotificationStatus = typeof NotificationStatus[keyof typeof NotificationStatus];

export function isBlueprintStatus(value: unknown): value is BlueprintStatus {
  return Object.values(BlueprintStatus).includes(value as BlueprintStatus);
}

export function isValidationStatus(value: unknown): value is ValidationStatus {
  return Object.values(ValidationStatus).includes(value as ValidationStatus);
}

export function isValidationKind(value: unknown): value is ValidationKind {
  return Object.values(ValidationKind).includes(value as ValidationKind);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}

export function isApiOrderStatus(value: unknown): value is ApiOrderStatus {
  return Object.values(ApiOrderStatus).includes(value as ApiOrderStatus);
}

export function isConditionState(value: unknown): value is ConditionState {
  return Object.values(ConditionState).includes(value as ConditionState);
}

export function isPhaseStatus(value: unknown): value is PhaseStatus {
  return Object.values(PhaseStatus).includes(value as PhaseStatus);
}
