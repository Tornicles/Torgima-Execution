import { db, bhudhiGovernanceAudit } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { AuditEventType, GovernanceActor, GovernanceAction } from "../contracts/types.js";

export interface AuditEntryInput {
  blueprintId?: string;
  eventType: AuditEventType;
  actor: GovernanceActor;
  action: GovernanceAction;
  decision: string;
  reasoning: string;
  payload?: Record<string, unknown>;
  memoryRefs?: string[];
  approvalId?: string;
  result?: string;
  rollbackId?: string;
}

/** Append-only governance audit — never delete, never update */
export class GovernanceAudit {
  async append(entry: AuditEntryInput): Promise<string> {
    const [row] = await db
      .insert(bhudhiGovernanceAudit)
      .values({
        blueprint_id: entry.blueprintId ?? null,
        event_type: entry.eventType,
        actor_type: entry.actor.type,
        actor_id: entry.actor.id,
        action: entry.action,
        decision: entry.decision,
        reasoning: entry.reasoning,
        payload: entry.payload ?? {},
        memory_refs: entry.memoryRefs ?? [],
        approval_id: entry.approvalId ?? null,
        result: entry.result ?? null,
        rollback_id: entry.rollbackId ?? null,
      })
      .returning({ id: bhudhiGovernanceAudit.id });

    return row!.id;
  }

  async list(blueprintId?: string, limit = 50) {
    if (blueprintId) {
      return db
        .select()
        .from(bhudhiGovernanceAudit)
        .where(eq(bhudhiGovernanceAudit.blueprint_id, blueprintId))
        .orderBy(desc(bhudhiGovernanceAudit.created_at))
        .limit(limit);
    }
    return db
      .select()
      .from(bhudhiGovernanceAudit)
      .orderBy(desc(bhudhiGovernanceAudit.created_at))
      .limit(limit);
  }

  async countSince(blueprintId: string, hours = 24): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({ id: bhudhiGovernanceAudit.id })
      .from(bhudhiGovernanceAudit)
      .where(eq(bhudhiGovernanceAudit.blueprint_id, blueprintId));

    return rows.filter((r) => r).length;
  }

  /** Deletion is constitutionally forbidden */
  async delete(): Promise<never> {
    throw new Error("Governance audit logs are immutable and cannot be deleted");
  }
}

export const governanceAudit = new GovernanceAudit();
