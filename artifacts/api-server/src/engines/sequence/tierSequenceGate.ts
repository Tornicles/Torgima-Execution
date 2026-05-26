import type { Request, Response, NextFunction } from "express";
import { blueprints, db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { failure as respondFailure } from "../../lib/utils.js";
import {
  SequenceTracker,
  normalizeBlueprintTier,
  type BlueprintSequenceRow,
} from "./SequenceTracker.js";
import type { BlueprintTierLabel } from "../../types/sequences.js";

export type { BlueprintSequenceRow };

export async function loadBlueprintForUser(
  userId: string,
  blueprintId?: string,
): Promise<BlueprintSequenceRow | null> {
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
    return row?.user_id === userId ? row : null;
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

export function checkTierAccess(
  blueprint: BlueprintSequenceRow,
  requiredTier: "Growth" | "Ultimate",
): { allowed: boolean; reason?: string } {
  const tier = normalizeBlueprintTier(
    blueprint.tier,
    blueprint.blueprint_tier,
    blueprint.selected_blueprint_level,
  );

  if (requiredTier === "Growth") {
    if (tier === "Starter") {
      return { allowed: false, reason: "Growth tier required" };
    }
  }

  if (requiredTier === "Ultimate") {
    if (tier !== "Ultimate") {
      return { allowed: false, reason: "Ultimate tier required" };
    }
  }

  return { allowed: true };
}

export function checkSequenceAccess(
  blueprint: BlueprintSequenceRow,
  requiredSequence: number,
): { allowed: boolean; reason?: string } {
  if (SequenceTracker.isSequenceLocked(blueprint, requiredSequence)) {
    return { allowed: false, reason: `Sequence ${requiredSequence} is locked` };
  }
  return { allowed: true };
}

export function requireTierAccessMiddleware(requiredTier: "Growth" | "Ultimate") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string | undefined;
      if (!userId) {
        respondFailure(res, "UNAUTHORIZED", "Not authenticated", 401);
        return;
      }

      const blueprintId =
        (req.params.blueprintId as string | undefined) ??
        (req.body?.blueprintId as string | undefined) ??
        (req.query?.blueprintId as string | undefined);

      const blueprint = await loadBlueprintForUser(userId, blueprintId);
      if (!blueprint) {
        respondFailure(res, "NOT_FOUND", "No active blueprint", 404);
        return;
      }

      const check = checkTierAccess(blueprint, requiredTier);
      if (!check.allowed) {
        respondFailure(res, "FORBIDDEN", check.reason ?? "Tier access denied", 403);
        return;
      }

      res.locals.blueprintId = blueprint.id;
      res.locals.blueprintRow = blueprint;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export { requireSequenceAccess as requireSequenceAccessMiddleware } from "./sequenceGuard.js";

export function tierUnlockHint(tier: BlueprintTierLabel): string {
  if (tier === "Starter") return "Complete Sequence 23 and upgrade to Growth to unlock Growth Intelligence (Seq 24).";
  if (tier === "Growth") return "Complete Sequence 24 to unlock Ultimate Intelligence (Seq 25).";
  return "All 25 sequences available on Ultimate tier.";
}
