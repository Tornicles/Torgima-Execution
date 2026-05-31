/**
 * Hierarchy generation facade — delegates to BlueprintEngine.buildBlueprintChain
 * (BlueprintChainGenerator + compileInTransaction). Emits blueprint_structure_created.
 */
import { BlueprintEngine } from "./BlueprintEngine.js";
import { db, actions, blueprints } from "@workspace/db";
import { and, count, eq } from "drizzle-orm";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { logger } from "../../lib/logger.js";

const blueprintEngine = new BlueprintEngine();

export class BlueprintGenerationService {
  /** Ensures hierarchy exists (launch uses activateBlueprint); emits structure-created for workers. */
  static async generate(blueprintId: string, userId: string): Promise<void> {
    const [bp] = await db
      .select({ goal: blueprints.goal, status: blueprints.status })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);

    if (!bp) throw new Error("Blueprint not found");

    const [actionCount] = await db
      .select({ n: count() })
      .from(actions)
      .where(eq(actions.blueprint_id, blueprintId));

    let chain = {
      planId: "",
      phaseId: "",
      planCount: 0,
      phaseCount: 0,
      targetCount: 0,
      actionCount: Number(actionCount?.n ?? 0),
      seasonCount: 0,
    };

    if (chain.actionCount === 0) {
      const built = await blueprintEngine.buildBlueprintChain(blueprintId, userId, bp.goal);
      chain = { ...built, seasonCount: 0 };
    }

    await writeEvent({
      eventType: EVENT_TYPES.BLUEPRINT_STRUCTURE_CREATED,
      entityType: "blueprint",
      entityId: blueprintId,
      userId,
      blueprintId,
      payload: {
        tier: chain.planCount > 0 ? "generated" : "unknown",
        plan_count: chain.planCount,
        phase_count: chain.phaseCount,
        target_count: chain.targetCount,
        action_count: chain.actionCount,
        plan_id: chain.planId,
        phase_id: chain.phaseId,
      },
      idempotencyKey: `blueprint_structure:${blueprintId}`,
    });

    logger.info(
      {
        blueprintId,
        plans: chain.planCount,
        phases: chain.phaseCount,
        actions: chain.actionCount,
      },
      "[BlueprintGen] Hierarchy created",
    );
  }
}
