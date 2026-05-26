import { db, bhudhiGovernanceMemory, bhudhiGovernanceViolations } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

/** Governance-only memory — never mixed with user/bhudhi operational memory */
export class GovernanceMemory {
  async store(
    blueprintId: string,
    memoryType: string,
    key: string,
    value: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    await db
      .insert(bhudhiGovernanceMemory)
      .values({
        blueprint_id: blueprintId,
        memory_type: memoryType,
        key,
        value,
        updated_at: now,
      })
      .onConflictDoNothing();
  }

  async get(blueprintId: string, memoryType: string, key: string) {
    const [row] = await db
      .select()
      .from(bhudhiGovernanceMemory)
      .where(
        and(
          eq(bhudhiGovernanceMemory.blueprint_id, blueprintId),
          eq(bhudhiGovernanceMemory.memory_type, memoryType),
          eq(bhudhiGovernanceMemory.key, key),
        ),
      )
      .limit(1);
    return row?.value ?? null;
  }

  async recordViolation(params: {
    blueprintId?: string;
    actorType: string;
    actorId: string;
    action: string;
    violationType: string;
    severity: string;
    detail: string;
  }): Promise<string> {
    const [row] = await db
      .insert(bhudhiGovernanceViolations)
      .values({
        blueprint_id: params.blueprintId ?? null,
        actor_type: params.actorType,
        actor_id: params.actorId,
        action: params.action,
        violation_type: params.violationType,
        severity: params.severity,
        detail: params.detail,
      })
      .returning({ id: bhudhiGovernanceViolations.id });

    return row!.id;
  }

  async getTrustScore(blueprintId: string): Promise<number> {
    const violations = await db
      .select()
      .from(bhudhiGovernanceViolations)
      .where(
        and(
          eq(bhudhiGovernanceViolations.blueprint_id, blueprintId),
          eq(bhudhiGovernanceViolations.resolved, false),
        ),
      );

    const penalty = Math.min(0.5, violations.length * 0.05);
    const stored = await this.get(blueprintId, "trust", "score");
    const base = typeof stored === "object" && stored && "value" in (stored as object)
      ? Number((stored as { value: number }).value)
      : 0.75;

    return Math.max(0.1, base - penalty);
  }

  async listRecentViolations(blueprintId: string, limit = 10) {
    return db
      .select()
      .from(bhudhiGovernanceViolations)
      .where(eq(bhudhiGovernanceViolations.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiGovernanceViolations.created_at))
      .limit(limit);
  }
}

export const governanceMemory = new GovernanceMemory();
