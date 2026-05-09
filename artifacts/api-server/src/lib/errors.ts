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
  | "FEATURE_DISABLED";

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
      return 404;
    case "VALIDATION_ERROR":
      return 422;
    case "STALE_STATE":
      return 409;
    case "FEATURE_DISABLED":
      return 403;
    case "RATE_LIMITED":
      return 429;
    default:
      return 500;
  }
}
