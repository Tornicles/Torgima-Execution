import { LANGUAGE } from "@/lib/language";

export function getUserFacingError(errorCode: string): string {
  const map: Record<string, string> = {
    INTERNAL_ERROR: LANGUAGE.errors.generic,
    UNAUTHENTICATED: LANGUAGE.errors.unauthorized,
    NOT_FOUND: LANGUAGE.errors.notFound,
    RATE_LIMITED: LANGUAGE.errors.serverBusy,
    VALIDATION_ERROR: "Please check your input and try again.",
    STALE_STATE: "Your page is out of sync. Refreshing...",
    SYSTEM_LOCKED: LANGUAGE.states.locked,
    SCHEMA_OUT_OF_DATE: LANGUAGE.errors.generic,
    LAUNCH_FAILED: LANGUAGE.errors.launchFailed,
    BHUDHI_UNAVAILABLE:
      "Our AI is temporarily busy. We'll use standard recommendations.",
    INVALID_STATE: LANGUAGE.states.locked,
    DEPENDENCY_BLOCKED: LANGUAGE.states.blocked,
    BLUEPRINT_ALREADY_ACTIVE: LANGUAGE.project.launched,
  };
  return map[errorCode] ?? LANGUAGE.errors.generic;
}
