import {
  db,
  bhudhiOrganizations,
  bhudhiOrganizationRoles,
  bhudhiOrganizationHealth,
  bhudhiOrganizationEvents,
  bhudhiOrganizationMemory,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { OrgOutput } from "./contracts/types.js";
import type { AuthorityLevel, Permission } from "./contracts/types.js";

export async function persistOrganization(
  output: OrgOutput,
  input: { blueprintId: string },
  roles: Array<{
    userId?: string;
    roleKey: string;
    authority: AuthorityLevel;
    permissions: Permission[];
    department?: string;
  }>,
): Promise<void> {
  const orgId = output.organizationState.organizationId;

  await db.insert(bhudhiOrganizations).values({
    id: orgId,
    blueprint_id: input.blueprintId,
    name: output.organizationState.name,
    organization_state: output.organizationState,
    capacity: output.capacity,
    alignment: output.alignment.score,
    health_score: output.health.score,
  });

  for (const r of roles) {
    await db.insert(bhudhiOrganizationRoles).values({
      organization_id: orgId,
      user_id: r.userId ?? null,
      role_key: r.roleKey,
      authority_level: r.authority,
      department: r.department ?? null,
      permissions: r.permissions,
    });
  }

  await db.insert(bhudhiOrganizationHealth).values({
    organization_id: orgId,
    execution_score: output.health.execution,
    culture_score: output.health.culture,
    strategy_score: output.health.strategy,
    risk_score: output.health.risk,
    resilience_score: output.health.resilience,
    overall_score: output.health.score,
    action: output.health.action,
  });

  await db.insert(bhudhiOrganizationMemory).values({
    organization_id: orgId,
    memory_type: "session",
    snapshot: output as unknown as Record<string, unknown>,
  });

  if (output.health.action === "escalate") {
    await db.insert(bhudhiOrganizationEvents).values({
      organization_id: orgId,
      blueprint_id: input.blueprintId,
      event_type: "health",
      description: `Health score ${output.health.score} — escalate`,
      action: output.health.action,
    });
  }
}

export async function listOrganizationHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiOrganizations)
    .where(eq(bhudhiOrganizations.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiOrganizations.updated_at))
    .limit(limit);

  return rows.map((r) => ({
    organizationId: r.id,
    name: r.name,
    healthScore: r.health_score,
    alignment: r.alignment,
    updatedAt: r.updated_at,
  }));
}

export async function getOrganization(orgId: string) {
  const rows = await db
    .select()
    .from(bhudhiOrganizations)
    .where(eq(bhudhiOrganizations.id, orgId))
    .limit(1);
  return rows[0] ?? null;
}
