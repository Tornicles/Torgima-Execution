import { db, blueprints, validations, orders } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { DomainResolutionEngine } from "../engines/domain/DomainResolutionEngine.js";
import { checkContradictionBlock } from "../engines/blueprint/BlueprintGovernanceEngine.js";
import { analyzeBlueprint, generateInterpretation } from "../bhudhi/agents/BlueprintAgent.js";
import { getWorldModel, updateWorldModel } from "../engines/world-model/WorldModelEngine.js";
import { writeEvent, EVENT_TYPES } from "./EventService.js";
import { TorgimaError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { BlueprintLaunchService, type LaunchPathType } from "./BlueprintLaunchService.js";
import { BlueprintStatus } from "@workspace/state-machine";

const domainEngine = new DomainResolutionEngine();

export async function getBlueprintGenerateReady(userId: string): Promise<{
  ready: boolean;
  reason?: string;
  blueprintId?: string;
}> {
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.status, BlueprintStatus.DRAFT)))
    .limit(1);

  if (!bp) return { ready: false, reason: "No draft blueprint" };

  const [val] = bp.validation_id
    ? await db.select().from(validations).where(eq(validations.id, bp.validation_id)).limit(1)
    : [null];

  const verdict = val?.verdict;
  if (verdict !== "proceed" && verdict !== "adjust") {
    return { ready: false, reason: "Validation must be Proceed or Adjust", blueprintId: bp.id };
  }

  return { ready: true, blueprintId: bp.id };
}

export async function resolveBlueprintDomain(
  blueprintId: string,
  userId: string,
): Promise<{ domain: string; confidence: number }> {
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);
  if (!bp) throw new TorgimaError("NOT_FOUND", "Blueprint not found");

  const domain = domainEngine.resolve(bp.goal, bp.domain_hint);
  await db
    .update(blueprints)
    .set({
      current_domain: domain,
      domain_hint: bp.domain_hint ?? String(domain),
      intel_metadata: {
        domainConfidence: 0.75,
        resolvedAt: new Date().toISOString(),
      },
    })
    .where(eq(blueprints.id, blueprintId));

  return { domain: String(domain), confidence: 0.75 };
}

export async function runFullBlueprintGenerationFlow(params: {
  userId: string;
  blueprintId: string;
  validationContractId: string;
  selectedPathType: LaunchPathType;
}): Promise<{
  blueprintId: string;
  activated: boolean;
  interpretationCached: boolean;
  firstOrderId?: string;
}> {
  const block = await checkContradictionBlock(params.blueprintId);
  if (block.blocked) {
    throw new TorgimaError("VALIDATION_ERROR", block.reason ?? "Contradiction block");
  }

  await resolveBlueprintDomain(params.blueprintId, params.userId);

  const world = await getWorldModel(params.userId);
  const stateVersion = world?.stateVersion ?? 0;

  await analyzeBlueprint({
    blueprintId: params.blueprintId,
    userId: params.userId,
    worldStateVersion: stateVersion,
    triggerReason: "CREATION",
  });

  const launch = await BlueprintLaunchService.launch({
    blueprintId: params.blueprintId,
    userId: params.userId,
    validationContractId: params.validationContractId,
    selectedPathType: params.selectedPathType,
  });

  await updateWorldModel(params.userId, "SCHEDULED");

  const interp = await generateInterpretation(params.blueprintId, params.userId, { forceRefresh: true });

  await writeEvent({
    eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
    entityType: "blueprint",
    entityId: params.blueprintId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: { trigger: "first_order_after_activation" },
    idempotencyKey: `first_order:${params.blueprintId}`,
  }).catch(() => null);

  const [firstOrder] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.blueprint_id, params.blueprintId), eq(orders.user_id, params.userId)))
    .limit(1);

  logger.info({ blueprintId: params.blueprintId }, "[BlueprintGenerationFlow] Complete 9-step flow");

  return {
    blueprintId: params.blueprintId,
    activated: launch.launched,
    interpretationCached: Boolean(interp.interpretation),
    firstOrderId: firstOrder?.id,
  };
}
