/**
 * GAP G3 LAW 3 — CRITICAL health issues block new task generation until resolved.
 */

import { db, systemHealthLogs } from "@workspace/db";
import { and, eq, inArray, or, sql } from "drizzle-orm";

const OPEN_STATUSES = ["OPEN", "degraded", "IN_PROGRESS"] as const;

const CRITICAL_ISSUE_CODES = new Set([
  "DUPLICATE_IS_CURRENT_SIGNAL",
  "DUPLICATE_IS_CURRENT_CONDITION",
  "DUPLICATE_IS_CURRENT_ENFORCEMENT_PACKAGE",
  "DUPLICATE_IS_CURRENT_STATE_MEMORY",
  "EVENT_BACKLOG_HIGH",
  "CRITICAL_DLQ_BLOCKER",
  "CRITICAL_EVENT_DEAD_LETTERED",
  "FATAL",
  "CRITICAL",
]);

function isMissingRelationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist|relation .* does not exist|parserOpenTable/i.test(msg);
}

export async function isBlueprintExecutionLocked(blueprintId: string): Promise<{
  locked: boolean;
  issueCode?: string;
  message?: string;
}> {
  let rows: Array<{
    check_type: string;
    severity: string | null;
    message: string | null;
    details_json: unknown;
  }>;
  try {
    rows = await db
      .select({
        check_type: systemHealthLogs.check_type,
        severity: systemHealthLogs.severity,
        message: systemHealthLogs.message,
        details_json: systemHealthLogs.details_json,
      })
      .from(systemHealthLogs)
      .where(
        and(
          eq(systemHealthLogs.blueprint_id, blueprintId),
          inArray(systemHealthLogs.status, [...OPEN_STATUSES]),
          or(
            inArray(systemHealthLogs.severity, ["CRITICAL", "FATAL"]),
            inArray(systemHealthLogs.check_type, ["FATAL", "CRITICAL"]),
            sql`(${systemHealthLogs.details_json}->>'severity') IN ('CRITICAL', 'FATAL')`,
          ),
        ),
      )
      .limit(5);
  } catch (err) {
    if (isMissingRelationError(err)) return { locked: false };
    throw err;
  }

  for (const row of rows) {
    const sev =
      row.severity ??
      (row.details_json as Record<string, unknown> | null)?.["severity"]?.toString();
    const code = row.check_type;
    if (
      sev === "CRITICAL" ||
      sev === "FATAL" ||
      CRITICAL_ISSUE_CODES.has(code) ||
      code.startsWith("DUPLICATE_IS_CURRENT_")
    ) {
      return {
        locked: true,
        issueCode: code,
        message:
          row.message ??
          `Execution locked: ${code}`,
      };
    }
  }

  return { locked: false };
}
