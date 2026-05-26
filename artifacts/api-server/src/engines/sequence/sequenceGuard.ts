import type { Request, Response, NextFunction } from "express";
import { blueprints, db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { failure } from "../../lib/utils.js";
import { SequenceTracker } from "./SequenceTracker.js";

async function loadActiveBlueprint(userId: string, blueprintId?: string) {
  if (blueprintId) {
    const [row] = await db
      .select({
        id: blueprints.id,
        user_id: blueprints.user_id,
        tier: blueprints.tier,
        blueprint_tier: blueprints.blueprint_tier,
        selected_blueprint_level: blueprints.selected_blueprint_level,
        current_sequence_number: blueprints.current_sequence_number,
        sequences_completed_numbers: blueprints.sequences_completed_numbers,
        sequence_audit_log: blueprints.sequence_audit_log,
        last_sequence_update: blueprints.last_sequence_update,
      })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);
    if (row?.user_id !== userId) return null;
    return row;
  }

  const [row] = await db
    .select({
      id: blueprints.id,
      user_id: blueprints.user_id,
      tier: blueprints.tier,
      blueprint_tier: blueprints.blueprint_tier,
      selected_blueprint_level: blueprints.selected_blueprint_level,
      current_sequence_number: blueprints.current_sequence_number,
      sequences_completed_numbers: blueprints.sequences_completed_numbers,
      sequence_audit_log: blueprints.sequence_audit_log,
      last_sequence_update: blueprints.last_sequence_update,
    })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return row ?? null;
}

/**
 * Express middleware — block when numbered sequence is locked for the blueprint.
 */
export function requireSequenceAccess(requiredSequence: number, blueprintIdParam = "blueprintId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string | undefined;
      if (!userId) {
        failure(res, "UNAUTHORIZED", "Not authenticated", 401);
        return;
      }

      const blueprintId =
        (req.params[blueprintIdParam] as string | undefined) ??
        (req.body?.blueprintId as string | undefined) ??
        (req.query?.blueprintId as string | undefined);

      const blueprint = await loadActiveBlueprint(userId, blueprintId);
      if (!blueprint) {
        failure(res, "NOT_FOUND", "No active blueprint", 404);
        return;
      }

      if (SequenceTracker.isSequenceLocked(blueprint, requiredSequence)) {
        failure(res, "FORBIDDEN", `Sequence ${requiredSequence} is locked`, 403);
        return;
      }

      res.locals.blueprintId = blueprint.id;
      next();
    } catch (err) {
      next(err);
    }
  };
}
