import { db, governanceQueue, blueprints } from "@workspace/db";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { TorgimaError } from "../../lib/errors.js";
import { logUsage } from "../../bhudhi/UsageController.js";
import { applyGovernanceApproval } from "../blueprint/BlueprintGovernanceEngine.js";
import type { BlueprintMutationResult } from "../blueprint/BlueprintStructureService.js";
import type { GovernanceProposal } from "../../bhudhi/agents/BlueprintAgent.js";

function expiryDays(priority: string): number {
  if (priority === "HIGH" || priority === "CRITICAL") return 7;
  if (priority === "LOW") return 30;
  return 14;
}

export async function submitProposal(params: {
  proposal: GovernanceProposal;
  blueprintId: string;
  userId: string;
  worldStateVersion: number;
  proposingAgent?: string;
}): Promise<typeof governanceQueue.$inferSelect> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays(params.proposal.priority));

  const [row] = await db
    .insert(governanceQueue)
    .values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      proposal_type: params.proposal.proposalType,
      proposing_agent: params.proposingAgent ?? "BLUEPRINT",
      proposal_content: params.proposal.proposalContent,
      rationale: params.proposal.rationale,
      evidence_citations: params.proposal.evidenceCitations,
      impact_assessment: params.proposal.impactAssessment,
      priority: params.proposal.priority,
      world_state_version: params.worldStateVersion,
      expires_at: expiresAt,
      status: "PENDING",
    })
    .returning();

  if (!row) throw new TorgimaError("INTERNAL_ERROR", "Failed to submit governance proposal");
  return row;
}

export async function getPendingProposals(
  blueprintId: string,
): Promise<Array<typeof governanceQueue.$inferSelect>> {
  return db
    .select()
    .from(governanceQueue)
    .where(and(eq(governanceQueue.blueprint_id, blueprintId), eq(governanceQueue.status, "PENDING")))
    .orderBy(desc(governanceQueue.priority), desc(governanceQueue.created_at));
}

export async function getProposalHistory(
  blueprintId: string,
): Promise<Array<typeof governanceQueue.$inferSelect>> {
  return db
    .select()
    .from(governanceQueue)
    .where(
      and(
        eq(governanceQueue.blueprint_id, blueprintId),
        inArray(governanceQueue.status, ["APPROVED", "REJECTED", "EXPIRED"]),
      ),
    )
    .orderBy(desc(governanceQueue.created_at));
}

export async function approveProposal(
  queueItemId: string,
  userId: string,
): Promise<BlueprintMutationResult> {
  const [item] = await db.select().from(governanceQueue).where(eq(governanceQueue.id, queueItemId)).limit(1);
  if (!item) throw new TorgimaError("NOT_FOUND", "Governance item not found");
  if (item.user_id !== userId) throw new TorgimaError("FORBIDDEN", "Not your blueprint");
  if (item.status !== "PENDING") {
    throw new TorgimaError("VALIDATION_ERROR", "Proposal is not pending");
  }
  if (item.expires_at && item.expires_at < new Date()) {
    throw new TorgimaError("VALIDATION_ERROR", "Proposal has expired");
  }

  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, item.blueprint_id))
    .limit(1);

  if (!bp || bp.state_version !== item.world_state_version) {
    throw new TorgimaError("STALE_STATE", "World state has advanced since this proposal was created");
  }

  const mutation = await applyGovernanceApproval(queueItemId);

  await db
    .update(governanceQueue)
    .set({ status: "APPROVED", approved_at: new Date() })
    .where(eq(governanceQueue.id, queueItemId));

  return mutation;
}

export async function rejectProposal(
  queueItemId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const [item] = await db.select().from(governanceQueue).where(eq(governanceQueue.id, queueItemId)).limit(1);
  if (!item) throw new TorgimaError("NOT_FOUND", "Governance item not found");
  if (item.user_id !== userId) throw new TorgimaError("FORBIDDEN", "Not your blueprint");
  if (item.status !== "PENDING") {
    throw new TorgimaError("VALIDATION_ERROR", "Proposal is not pending");
  }

  await db
    .update(governanceQueue)
    .set({ status: "REJECTED", rejected_at: new Date(), approval_note: reason ?? null })
    .where(eq(governanceQueue.id, queueItemId));

  await logUsage({
    userId,
    blueprintId: item.blueprint_id,
    triggerType: "STATE_EXPLANATION",
    promptName: "governance.reject",
    promptVersion: "1.0",
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
    status: "rejected",
    fallbackReason: reason,
  }).catch(() => null);
}

export async function expireStaleProposals(): Promise<number> {
  const now = new Date();
  const stale = await db
    .select({ id: governanceQueue.id })
    .from(governanceQueue)
    .where(and(eq(governanceQueue.status, "PENDING"), lt(governanceQueue.expires_at, now)));

  if (stale.length === 0) return 0;

  await db
    .update(governanceQueue)
    .set({ status: "EXPIRED" })
    .where(and(eq(governanceQueue.status, "PENDING"), lt(governanceQueue.expires_at, now)));

  return stale.length;
}
