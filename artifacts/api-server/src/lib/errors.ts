export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "STALE_STATE"
  | "SYSTEM_LOCKED"
  | "BLUEPRINT_ALREADY_ACTIVE"
  | "BLUEPRINT_NOT_ACTIVE"
  | "BLUEPRINT_NOT_PAUSED"
  | "BLUEPRINT_PAUSED"
  | "BLUEPRINT_COMPLETE"
  | "TASK_IN_PROGRESS"
  | "NO_ACTIVE_BLUEPRINT"
  | "PIVOT_REVIEW_OPEN"
  | "COMPLETION_BLOCKED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "AI_CONTRACT_ERROR"
  | "FEATURE_DISABLED"
  | "BLUEPRINT_SELECTION_REQUIRED"
  | "SCHEMA_OUT_OF_DATE"
  | "CONTRACT_NOT_FOUND"
  | "VALIDATION_PAYLOAD_CORRUPT"
  | "FALSE_PROGRESS_BLOCKED"
  | "PHASE_NOT_READY"
  | "INTERNAL";

export class TorgimaError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "TorgimaError";
  }
}

export function isTorgimaError(err: unknown): err is TorgimaError {
  return err instanceof TorgimaError;
}

export function torgimaErrorToStatus(code: ErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
    case "CONTRACT_NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
    case "VALIDATION_PAYLOAD_CORRUPT":
      return 422;
    case "STALE_STATE":
      return 409;
    case "FEATURE_DISABLED":
      return 403;
    case "BLUEPRINT_SELECTION_REQUIRED":
      return 422;
    case "RATE_LIMITED":
      return 429;
    case "SCHEMA_OUT_OF_DATE":
      return 503;
    default:
      return 500;
  }
}
