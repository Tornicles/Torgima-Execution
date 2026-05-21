/**
 * GAP G4 — health findings for state_version violations.
 */

import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { BlueprintStatus } from "@workspace/state-machine";
import type { HealthFinding } from "../../services/SystemHealthService.js";

export async function checkStateVersionIntegrity(): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [];

  const zeroVersionActive = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(
      and(
        eq(blueprints.status, BlueprintStatus.ACTIVE),
        eq(blueprints.active, true),
        eq(blueprints.state_version, 0),
      ),
    )
    .limit(20);

  for (const bp of zeroVersionActive) {
    findings.push({
      area: "STATE_VERSION",
      severity: "ERROR",
      issueCode: "ACTIVE_BLUEPRINT_ZERO_STATE_VERSION",
      blueprintId: bp.id,
      userId: bp.user_id,
      entityType: "blueprint",
      entityId: bp.id,
      expected: "state_version >= 1 on active blueprint",
      actual: "state_version = 0",
      repairable: true,
      repairAction: "ADMIN_REVIEW",
    });
  }

  return findings;
}
