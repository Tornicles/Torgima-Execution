import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import {
  getCharacterProgression,
  updateCharacterScores,
} from "../engines/character/CharacterProgressionEngine.js";
import { db, identityProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/character/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const character = await getCharacterProgression(auth.userId);
    const [identity] = await db
      .select()
      .from(identityProfiles)
      .where(eq(identityProfiles.user_id, auth.userId))
      .limit(1);

    success(res, {
      character: character
        ? {
            consistency: character.consistency,
            grit: character.grit,
            discipline: character.discipline,
            executionIntelligence: character.execution_intelligence,
            adaptability: character.adaptability,
            overallCharacterScore: character.overall_character_score,
            characterLevel: character.character_level,
            updatedAt: character.updated_at,
          }
        : null,
      identity: identity
        ? {
            stage: identity.identity_stage,
            confidenceScore: identity.confidence_score,
            purposeAlignment: identity.purpose_alignment,
            milestonesReached: identity.milestones_reached,
          }
        : null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/character/refresh", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const character = await updateCharacterScores(auth.userId);
    success(res, { character });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
