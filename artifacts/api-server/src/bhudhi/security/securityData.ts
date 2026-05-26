import {
  db,
  bhudhiSecurityEvents,
  bhudhiTrustProfiles,
  bhudhiThreatRecords,
  bhudhiPermissionHistory,
  bhudhiSecretRegistry,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { SecurityOutput, ThreatResult, TrustResult } from "./contracts/types.js";
import type { AuthorizationResult } from "./contracts/types.js";
import type { SecretRef } from "./contracts/types.js";

export async function persistSecurityVerify(
  output: SecurityOutput,
  blueprintId: string,
  actorId?: string,
): Promise<void> {
  await db.insert(bhudhiSecurityEvents).values({
    blueprint_id: blueprintId,
    event_type: "verify",
    actor_id: actorId ?? null,
    trust_score: output.trustScore,
    risk: output.risk,
    decision: output.decision,
    payload: {
      permissions: output.permissions,
      trustLevel: output.trustLevel,
    },
  });
}

export async function persistTrustProfile(
  blueprintId: string,
  subjectId: string,
  trust: TrustResult,
): Promise<void> {
  await db.insert(bhudhiTrustProfiles).values({
    blueprint_id: blueprintId,
    subject_id: subjectId,
    trust_level: trust.trustLevel,
    trust_score: trust.trustScore,
    reasons: trust.reasons,
    expires_at: new Date(trust.expiration),
  });
}

export async function persistThreat(blueprintId: string, threat: ThreatResult): Promise<void> {
  if (threat.threat === "none") return;
  await db.insert(bhudhiThreatRecords).values({
    blueprint_id: blueprintId,
    threat: threat.threat,
    severity: threat.severity,
    containment: threat.containment,
    detail: {},
  });
}

export async function persistPermission(
  blueprintId: string,
  subjectId: string,
  permission: string,
  auth: AuthorizationResult,
): Promise<void> {
  await db.insert(bhudhiPermissionHistory).values({
    blueprint_id: blueprintId,
    subject_id: subjectId,
    permission,
    allowed: auth.allowed,
    constraints: auth.constraints,
    approvals: auth.approvals,
  });
}

export async function persistSecretRef(blueprintId: string, ref: SecretRef): Promise<void> {
  await db.insert(bhudhiSecretRegistry).values({
    blueprint_id: blueprintId,
    secret_key: ref.secretKey,
    secret_type: ref.secretType,
    vault_ref: ref.vaultRef,
    expires_at: ref.expiresAt ? new Date(ref.expiresAt) : null,
    revoked: ref.revoked,
  });
}

export async function listSecurityHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiSecurityEvents)
    .where(eq(bhudhiSecurityEvents.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiSecurityEvents.created_at))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    trustScore: r.trust_score,
    risk: r.risk,
    decision: r.decision,
    createdAt: r.created_at,
  }));
}
