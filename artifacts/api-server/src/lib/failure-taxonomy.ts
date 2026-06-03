/**
 * DOC 37 — classify every API error before handling/logging.
 */
export type FailureClass =
  | "validation_error"
  | "auth_error"
  | "state_integrity_error"
  | "engine_error"
  | "event_error"
  | "ai_contract_error"
  | "external_dependency_error";

const CODE_TO_CLASS: Record<string, FailureClass> = {
  VALIDATION_ERROR: "validation_error",
  VALIDATION_PAYLOAD_CORRUPT: "validation_error",
  ACTIVATION_FAILED: "validation_error",
  BLUEPRINT_SELECTION_REQUIRED: "validation_error",
  FALSE_PROGRESS_BLOCKED: "validation_error",
  PAYLOAD_TOO_LARGE: "validation_error",

  UNAUTHENTICATED: "auth_error",
  FORBIDDEN: "auth_error",
  FEATURE_DISABLED: "auth_error",
  RATE_LIMITED: "auth_error",

  STALE_STATE: "state_integrity_error",
  SYSTEM_LOCKED: "state_integrity_error",
  BLUEPRINT_NOT_ACTIVE: "state_integrity_error",
  BLUEPRINT_ALREADY_ACTIVE: "state_integrity_error",
  BLUEPRINT_NOT_PAUSED: "state_integrity_error",
  BLUEPRINT_PAUSED: "state_integrity_error",
  BLUEPRINT_COMPLETE: "state_integrity_error",
  NO_ACTIVE_BLUEPRINT: "state_integrity_error",
  PIVOT_REVIEW_OPEN: "state_integrity_error",
  COMPLETION_BLOCKED: "state_integrity_error",
  ENFORCEMENT_PACKAGE_MISSING: "state_integrity_error",
  INVALID_STATE: "state_integrity_error",

  INTERNAL_ERROR: "engine_error",
  TASK_IN_PROGRESS: "engine_error",
  PHASE_NOT_READY: "engine_error",

  AI_CONTRACT_ERROR: "ai_contract_error",
  BHUDHI_LOG_FAILURE: "ai_contract_error",

  SERVICE_UNAVAILABLE: "external_dependency_error",
  SCHEMA_OUT_OF_DATE: "external_dependency_error",
  BHUDHI_UNAVAILABLE: "external_dependency_error",

  NOT_FOUND: "auth_error",
  CONTRACT_NOT_FOUND: "auth_error",
};

/** Event / outbox failures (DLQ, poison, duplicate). */
export function classifyEventFailure(reason: string): FailureClass {
  const r = reason.toLowerCase();
  if (r.includes("idempot") || r.includes("duplicate")) return "event_error";
  if (r.includes("stale") || r.includes("version")) return "state_integrity_error";
  if (r.includes("permission") || r.includes("forbidden")) return "auth_error";
  return "event_error";
}

export function classifyFailureCode(code: string): FailureClass {
  return CODE_TO_CLASS[code] ?? "engine_error";
}

export const DOC37_FAILURE_CLASSES: FailureClass[] = [
  "validation_error",
  "auth_error",
  "state_integrity_error",
  "engine_error",
  "event_error",
  "ai_contract_error",
  "external_dependency_error",
];
