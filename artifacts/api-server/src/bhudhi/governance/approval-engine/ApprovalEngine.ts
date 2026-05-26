import { db, bhudhiGovernanceApprovals } from "@workspace/db";
import { and, desc, eq, gt } from "drizzle-orm";
import type {
  ApprovalLevel,
  ApprovalRequest,
  GovernanceAction,
  GovernanceActor,
} from "../contracts/types.js";
import { actorMayApprove } from "../contracts/immutableRules.js";

export const APPROVAL_LEVEL_ORDER: ApprovalLevel[] = ["L0", "L1", "L2", "L3", "L4", "L5"];

function levelIndex(level: ApprovalLevel): number {
  return APPROVAL_LEVEL_ORDER.indexOf(level);
}

export class ApprovalEngine {
  async createApprovalRequest(req: ApprovalRequest): Promise<string> {
    const expiresAt = req.expiresInHours
      ? new Date(Date.now() + req.expiresInHours * 60 * 60 * 1000)
      : new Date(Date.now() + 72 * 60 * 60 * 1000);

    const [row] = await db
      .insert(bhudhiGovernanceApprovals)
      .values({
        blueprint_id: req.blueprintId,
        subject_type: req.subjectType,
        subject_id: req.subjectId,
        action: req.action,
        level: req.level,
        status: "pending",
        expires_at: expiresAt,
        metadata: {},
      })
      .returning({ id: bhudhiGovernanceApprovals.id });

    return row!.id;
  }

  async getPendingForSubject(
    blueprintId: string,
    subjectType: string,
    subjectId: string,
    action: GovernanceAction,
  ): Promise<Array<{ id: string; level: string; status: string }>> {
    const now = new Date();
    return db
      .select({
        id: bhudhiGovernanceApprovals.id,
        level: bhudhiGovernanceApprovals.level,
        status: bhudhiGovernanceApprovals.status,
      })
      .from(bhudhiGovernanceApprovals)
      .where(
        and(
          eq(bhudhiGovernanceApprovals.blueprint_id, blueprintId),
          eq(bhudhiGovernanceApprovals.subject_type, subjectType),
          eq(bhudhiGovernanceApprovals.subject_id, subjectId),
          eq(bhudhiGovernanceApprovals.action, action),
          eq(bhudhiGovernanceApprovals.status, "pending"),
          gt(bhudhiGovernanceApprovals.expires_at, now),
        ),
      );
  }

  async hasGrantedApproval(
    blueprintId: string,
    subjectType: string,
    subjectId: string,
    action: GovernanceAction,
    minLevel: ApprovalLevel,
  ): Promise<boolean> {
    const minIdx = levelIndex(minLevel);
    const rows = await db
      .select({ level: bhudhiGovernanceApprovals.level, status: bhudhiGovernanceApprovals.status })
      .from(bhudhiGovernanceApprovals)
      .where(
        and(
          eq(bhudhiGovernanceApprovals.blueprint_id, blueprintId),
          eq(bhudhiGovernanceApprovals.subject_type, subjectType),
          eq(bhudhiGovernanceApprovals.subject_id, subjectId),
          eq(bhudhiGovernanceApprovals.action, action),
          eq(bhudhiGovernanceApprovals.status, "granted"),
        ),
      );

    return rows.some((r) => levelIndex(r.level as ApprovalLevel) >= minIdx);
  }

  async grantApproval(
    approvalId: string,
    actor: GovernanceActor,
    level: ApprovalLevel,
  ): Promise<{ granted: boolean; reason?: string }> {
    if (!actorMayApprove(actor.type, level)) {
      return { granted: false, reason: `Actor ${actor.type} cannot grant ${level}` };
    }

    const [row] = await db
      .select()
      .from(bhudhiGovernanceApprovals)
      .where(eq(bhudhiGovernanceApprovals.id, approvalId))
      .limit(1);

    if (!row) return { granted: false, reason: "Approval not found" };
    if (row.status !== "pending") return { granted: false, reason: `Approval already ${row.status}` };

    await db
      .update(bhudhiGovernanceApprovals)
      .set({
        status: "granted",
        approver_type: actor.type,
        approver_id: actor.id,
        updated_at: new Date(),
      })
      .where(eq(bhudhiGovernanceApprovals.id, approvalId));

    return { granted: true };
  }

  async rejectApproval(
    approvalId: string,
    actor: GovernanceActor,
    reason: string,
  ): Promise<boolean> {
    const result = await db
      .update(bhudhiGovernanceApprovals)
      .set({
        status: "rejected",
        approver_type: actor.type,
        approver_id: actor.id,
        rejection_reason: reason,
        updated_at: new Date(),
      })
      .where(eq(bhudhiGovernanceApprovals.id, approvalId))
      .returning({ id: bhudhiGovernanceApprovals.id });

    return result.length > 0;
  }

  async listPending(blueprintId: string, limit = 20) {
    return db
      .select()
      .from(bhudhiGovernanceApprovals)
      .where(
        and(
          eq(bhudhiGovernanceApprovals.blueprint_id, blueprintId),
          eq(bhudhiGovernanceApprovals.status, "pending"),
        ),
      )
      .orderBy(desc(bhudhiGovernanceApprovals.created_at))
      .limit(limit);
  }
}

export const approvalEngine = new ApprovalEngine();
