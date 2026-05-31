/**
 * Action → project → phase cascade on completed feedback.
 * Phase-level advancement remains on BlueprintEngine.advanceBlueprintPosition (checkpoint API).
 */
import {
  db,
  actions,
  blueprints,
  orders,
  phases,
  plans,
  projects,
  targets,
} from "@workspace/db";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

export class BlueprintPositionEngine {
  /** Called when feedback marks an order completed — advances linked action chain. */
  static async advanceOnOrderCompleted(
    blueprintId: string,
    userId: string,
    orderId: string,
  ): Promise<{ advanced: boolean; actionId?: string }> {
    const [order] = await db
      .select({
        action_id: orders.action_id,
        linked_project_id: orders.linked_project_id,
        linked_phase_id: orders.linked_phase_id,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.user_id, userId)))
      .limit(1);

    if (!order?.action_id) {
      return { advanced: false };
    }

    return BlueprintPositionEngine.advancePosition(blueprintId, userId, order.action_id);
  }

  static async advancePosition(
    blueprintId: string,
    userId: string,
    completedActionId: string,
  ): Promise<{ advanced: boolean; actionId?: string }> {
    const [completedAction] = await db
      .select()
      .from(actions)
      .where(and(eq(actions.id, completedActionId), eq(actions.blueprint_id, blueprintId)))
      .limit(1);

    if (!completedAction) {
      return { advanced: false };
    }

    const now = new Date();

    await db
      .update(actions)
      .set({ status: "complete", completed_at: now })
      .where(eq(actions.id, completedActionId));

    const [nextAction] = await db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.project_id, completedAction.project_id),
          eq(actions.status, "pending"),
          gt(actions.order_index, completedAction.order_index),
        ),
      )
      .orderBy(asc(actions.order_index))
      .limit(1);

    if (nextAction) {
      await db.update(actions).set({ status: "pending" }).where(eq(actions.id, nextAction.id));
      await db
        .update(blueprints)
        .set({
          current_action_id: nextAction.id,
          current_project_id: nextAction.project_id,
          state_version: sql`${blueprints.state_version} + 1`,
        })
        .where(eq(blueprints.id, blueprintId));

      logger.info(
        { blueprintId, actionId: nextAction.id, name: nextAction.name },
        "[PositionEngine] Advanced to next action",
      );
      return { advanced: true, actionId: nextAction.id };
    }

    await db
      .update(projects)
      .set({ status: "complete", completed_at: now })
      .where(eq(projects.id, completedAction.project_id));

    const [completedProject] = await db
      .select({ phase_id: projects.phase_id, order_index: projects.order_index })
      .from(projects)
      .where(eq(projects.id, completedAction.project_id))
      .limit(1);

    if (!completedProject?.phase_id) {
      return { advanced: true, actionId: completedActionId };
    }

    const [nextProject] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.phase_id, completedProject.phase_id),
          eq(projects.status, "pending"),
          gt(projects.order_index, completedProject.order_index),
        ),
      )
      .orderBy(asc(projects.order_index))
      .limit(1);

    if (nextProject) {
      await db.update(projects).set({ status: "active" }).where(eq(projects.id, nextProject.id));
      const [firstAction] = await db
        .select()
        .from(actions)
        .where(eq(actions.project_id, nextProject.id))
        .orderBy(asc(actions.order_index))
        .limit(1);

      if (firstAction) {
        await db.update(actions).set({ status: "pending" }).where(eq(actions.id, firstAction.id));
        await db
          .update(blueprints)
          .set({
            current_project_id: nextProject.id,
            current_action_id: firstAction.id,
            state_version: sql`${blueprints.state_version} + 1`,
          })
          .where(eq(blueprints.id, blueprintId));
      }

      logger.info(
        { blueprintId, projectId: nextProject.id },
        "[PositionEngine] Advanced to next project",
      );
      return { advanced: true, actionId: firstAction?.id ?? undefined };
    }

    const phaseId = completedProject.phase_id;
    await db
      .update(phases)
      .set({ status: "complete", completed_at: now })
      .where(eq(phases.id, phaseId));

    await writeEvent({
      eventType: EVENT_TYPES.PHASE_CHECKPOINT_REQUIRED,
      entityType: "phase",
      entityId: phaseId,
      userId,
      blueprintId,
      payload: { completed_phase_id: phaseId, blueprint_id: blueprintId },
      idempotencyKey: `phase_checkpoint:${phaseId}`,
    });

    logger.info({ blueprintId, phaseId }, "[PositionEngine] Phase complete — checkpoint required");
    return { advanced: true, actionId: completedActionId };
  }
}
