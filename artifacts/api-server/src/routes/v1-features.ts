import { Router } from "express";
import { z } from "zod/v4";
import { blueprints, db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { SequenceTracker } from "../engines/sequence/SequenceTracker.js";
import { buildFeatureAvailability } from "../lib/featureGate.js";
import { tierUnlockHint } from "../engines/sequence/tierSequenceGate.js";
import { getTierNavItems } from "../lib/tierNav.js";

const router = Router();

async function activeBlueprintForUser(userId: string, blueprintId?: string) {
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
    })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return row ?? null;
}

// GET /api/v1/features/status?blueprintId=
router.get("/v1/features/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }

    const sequenceStatus = await SequenceTracker.getSequenceStatus(bp.id);
    const features = buildFeatureAvailability({
      tier: bp.tier,
      blueprint_tier: bp.blueprint_tier,
      selected_blueprint_level: bp.selected_blueprint_level,
      current_sequence_number: bp.current_sequence_number ?? 1,
      sequences_completed_numbers: bp.sequences_completed_numbers ?? [],
    });

    const navigation = getTierNavItems(
      sequenceStatus.tier,
      sequenceStatus.currentSequence,
      bp.sequences_completed_numbers ?? [],
    );

    success(res, {
      sequenceStatus,
      features,
      navigation,
      tierHint: tierUnlockHint(sequenceStatus.tier),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
