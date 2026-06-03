/**
 * DOC 30 §7 — security events to system_health_logs (no secrets in payload).
 */

import { db, systemHealthLogs } from "@workspace/db";
import { logger } from "./logger.js";

export type AuthSecurityEventType =
  | "CROSS_USER_ACCESS_ATTEMPT"
  | "BROWSER_INTERNAL_ROUTE_ATTEMPT"
  | "MAGIC_LINK_REUSE_ATTEMPT"
  | "MAGIC_LINK_INVALID"
  | "SESSION_EXPIRED_ON_MUTATION"
  | "SESSION_IDLE_EXPIRED"
  | "REPEATED_AUTH_FAILURE";

export async function logAuthSecurityEvent(
  eventType: AuthSecurityEventType,
  details: Record<string, unknown>,
  severity: "INFO" | "WARN" | "ERROR" = "WARN",
): Promise<void> {
  const safeDetails = { ...details };
  for (const key of Object.keys(safeDetails)) {
    if (/token|secret|password|authorization|cookie/i.test(key)) {
      delete safeDetails[key];
    }
  }

  if (severity === "ERROR") {
    logger.error({ eventType, ...safeDetails }, "[AuthSecurity]");
  } else if (severity === "WARN") {
    logger.warn({ eventType, ...safeDetails }, "[AuthSecurity]");
  } else {
    logger.info({ eventType, ...safeDetails }, "[AuthSecurity]");
  }

  await db
    .insert(systemHealthLogs)
    .values({
      check_type: eventType,
      severity,
      status: "OPEN",
      area: "auth",
      message: eventType,
      details_json: safeDetails,
      user_id: typeof safeDetails.userId === "string" ? safeDetails.userId : null,
      blueprint_id:
        typeof safeDetails.blueprintId === "string" ? safeDetails.blueprintId : null,
    })
    .catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), eventType },
        "[AuthSecurity] Failed to persist security log",
      );
    });
}
