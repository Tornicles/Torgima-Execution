import { db, governanceQueue, blueprintMutations, projects, phases, actions } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TorgimaError } from "../../lib/errors.js";
import { hasHardContradiction } from "../contradiction/ContradictionEngine.js";
import {
  incrementBlueprintWorldStateVersion,
  type BlueprintMutationResult,
} from "./BlueprintStructureService.js";
import { updateWorldModel } from "../world-model/WorldModelEngine.js";

export async function checkContradictionBlock(blueprintId: string): Promise<{
  blocked: boolean;
  reason?: string;
}> {
  const hard = await hasHardContradiction(blueprintId);
  if (hard) {
    return {
      blocked: true,
      reason: "Unresolved HARD contradiction — resolve before blueprint generation",
    };
  }
  return { blocked: false };
}

export async function applyGovernanceApproval(queueItemId: string): Promise<BlueprintMutationResult> {
  const [item] = await db.select().from(governanceQueue).where(eq(governanceQueue.id, queueItemId)).limit(1);
  if (!item) throw new TorgimaError("NOT_FOUND", "Governance item not found");

  const content = item.proposal_content as Record<string, unknown>;
  const changes: string[] = [];

  switch (item.proposal_type) {
    case "ADD_PHASE": {
      const title = String(content["title"] ?? "New phase");
      await db.insert(phases).values({
        blueprint_id: item.blueprint_id,
        plan_id: content["planId"] ? String(content["planId"]) : null,
        name: "development",
        order_index: Number(content["sequenceOrder"] ?? 99),
        status: "pending",
      });
      changes.push(`Added phase: ${title}`);
      break;
    }
    case "ADD_PROJECT": {
      const phaseId = String(content["phaseId"] ?? "");
      if (!phaseId) throw new TorgimaError("VALIDATION_ERROR", "ADD_PROJECT requires phaseId");
      await db.insert(projects).values({
        blueprint_id: item.blueprint_id,
        phase_id: phaseId,
        name: String(content["title"] ?? "New project"),
        type: "execution",
        status: "pending",
      });
      changes.push(`Added project to phase ${phaseId}`);
      break;
    }
    case "RESEQUENCE": {
      const entityType = String(content["entityType"] ?? "");
      const entityId = String(content["entityId"] ?? "");
      const order = Number(content["sequenceOrder"] ?? 0);
      if (entityType === "phase" && entityId) {
        await db.update(phases).set({ order_index: order }).where(eq(phases.id, entityId));
        changes.push(`Reordered phase ${entityId} to ${order}`);
      }
      break;
    }
    default:
      changes.push(`Recorded approval for ${item.proposal_type} (no structural auto-apply)`);
  }

  const newVersion = await incrementBlueprintWorldStateVersion(item.blueprint_id);

  await db.insert(blueprintMutations).values({
    blueprint_id: item.blueprint_id,
    mutation_type: item.proposal_type,
    layer: "governance",
    change_summary: changes.join("; "),
    approved: true,
    approved_at: new Date(),
  });

  await updateWorldModel(item.user_id, "SIGNAL_RECALC").catch(() => null);

  return { applied: true, changes, newWorldStateVersion: newVersion };
}
