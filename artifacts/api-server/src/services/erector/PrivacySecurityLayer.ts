import { createHash } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import {
  db,
  erectorCapabilityGaps,
  erectorCapabilityProfiles,
  erectorDecisionAudits,
  erectorEvidenceLedger,
  erectorIntakeSessions,
  erectorIntegrityFlags,
  erectorObservabilityLogs,
  erectorSystemErrorRecords,
  erectorUserRealityProfiles,
  erectorValidationRuns,
} from "@workspace/db";

const SENSITIVE_SNAPSHOT_FIELDS = new Set([
  "budget",
  "budget_available",
  "location",
  "city",
  "address",
  "prior_attempts",
  "regulatory_flags",
  "exact_budget",
]);

export function redactSensitiveValue(key: string, value: unknown): unknown {
  if (SENSITIVE_SNAPSHOT_FIELDS.has(key.toLowerCase())) {
    return "[REDACTED]";
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return redactAuditSnapshot(value as Record<string, unknown>);
  }
  return value;
}

export function redactAuditSnapshot(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    out[key] = redactSensitiveValue(key, value);
  }
  return out;
}

export function sanitizeLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return redactAuditSnapshot(payload);
}

function deletedUserId(userId: string): string {
  const hash = createHash("sha256").update(`deleted:${userId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4000-8000-${hash.slice(12, 24)}`;
}

export async function runRetentionCleanup(): Promise<{
  abandoned_sessions: number;
  observability_logs: number;
  system_errors: number;
  integrity_flags: number;
}> {
  const now = Date.now();
  const day = 86400000;

  const abandoned = await db
    .delete(erectorIntakeSessions)
    .where(
      and(
        eq(erectorIntakeSessions.status, "abandoned"),
        lt(erectorIntakeSessions.started_at, new Date(now - 90 * day)),
      ),
    )
    .returning({ id: erectorIntakeSessions.id });

  const observability = await db
    .delete(erectorObservabilityLogs)
    .where(lt(erectorObservabilityLogs.created_at, new Date(now - 90 * day)))
    .returning({ id: erectorObservabilityLogs.id });

  const systemErrors = await db
    .delete(erectorSystemErrorRecords)
    .where(lt(erectorSystemErrorRecords.created_at, new Date(now - 180 * day)))
    .returning({ id: erectorSystemErrorRecords.id });

  const integrity = await db
    .delete(erectorIntegrityFlags)
    .where(
      and(
        eq(erectorIntegrityFlags.status, "reviewed"),
        lt(erectorIntegrityFlags.reviewed_at, new Date(now - 365 * day)),
      ),
    )
    .returning({ id: erectorIntegrityFlags.id });

  return {
    abandoned_sessions: abandoned.length,
    observability_logs: observability.length,
    system_errors: systemErrors.length,
    integrity_flags: integrity.length,
  };
}

export async function handleUserDeletion(userId: string): Promise<void> {
  const anonymizedId = deletedUserId(userId);

  await db
    .update(erectorValidationRuns)
    .set({ user_id: anonymizedId })
    .where(eq(erectorValidationRuns.user_id, userId));

  await db
    .update(erectorDecisionAudits)
    .set({ user_id: anonymizedId })
    .where(eq(erectorDecisionAudits.user_id, userId));

  await db.delete(erectorIntakeSessions).where(eq(erectorIntakeSessions.user_id, userId));
  await db.delete(erectorUserRealityProfiles).where(eq(erectorUserRealityProfiles.user_id, userId));
  await db.delete(erectorCapabilityGaps).where(eq(erectorCapabilityGaps.user_id, userId));
  await db.delete(erectorCapabilityProfiles).where(eq(erectorCapabilityProfiles.user_id, userId));
  await db.delete(erectorEvidenceLedger).where(eq(erectorEvidenceLedger.user_id, userId));
}

export async function handleAnonymizationRequest(userId: string): Promise<void> {
  await db
    .update(erectorUserRealityProfiles)
    .set({ location: null })
    .where(eq(erectorUserRealityProfiles.user_id, userId));

  await db
    .update(erectorEvidenceLedger)
    .set({ source_location: null })
    .where(eq(erectorEvidenceLedger.user_id, userId));
}
