import { and, eq } from "drizzle-orm";
import { db, erectorIntakeSessions } from "@workspace/db";
import { TorgimaError } from "../../../lib/errors.js";
import { writeEvent, EVENT_TYPES } from "../../EventService.js";
import { updateBlueprintErectorState } from "../../../engines/erector/erectorStateMachine.js";
import { detectAmbiguity } from "./AmbiguityDetector.js";
import { detectContradictions } from "./ContradictionDetector.js";
import { normalizeIntake, rawIntakeFromSession, nextUnfilledIntakeSection } from "./IntakeNormalizer.js";
import { detectMissingFields } from "./MissingFieldDetector.js";
import type { IntakePipelineResult, IntakeTier } from "./types.js";
import { buildUserRealityProfile } from "./UserRealityProfileBuilder.js";

function toIntakeTier(tier: string): IntakeTier {
  if (tier === "free" || tier === "pro" || tier === "authenticated") return tier;
  return "authenticated";
}

export async function runIntakePipeline(
  sessionId: string,
  userId: string,
): Promise<IntakePipelineResult> {
  const [session] = await db
    .select()
    .from(erectorIntakeSessions)
    .where(and(eq(erectorIntakeSessions.id, sessionId), eq(erectorIntakeSessions.user_id, userId)))
    .limit(1);

  if (!session) {
    throw new TorgimaError("NOT_FOUND", "Intake session not found");
  }

  const completed = session.sections_completed ?? [];
  if (session.prefilled_from_handoff && completed.length > 0) {
    const nextSection = nextUnfilledIntakeSection(completed);
    if (nextSection !== session.current_section) {
      await db
        .update(erectorIntakeSessions)
        .set({ current_section: nextSection })
        .where(eq(erectorIntakeSessions.id, sessionId));
    }
  }

  const tier = toIntakeTier(session.tier);
  const raw = rawIntakeFromSession(sessionId, tier, session);
  const normalized = normalizeIntake(raw);
  const missingFields = detectMissingFields(normalized, tier);
  const ambiguity = detectAmbiguity(normalized);
  const contradictions = detectContradictions(normalized);

  const { profile_id, validation_ready } = await buildUserRealityProfile(
    userId,
    sessionId,
    tier,
    normalized,
    missingFields,
    ambiguity,
    contradictions,
  );

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_INTAKE_NORMALIZED,
    entityType: "erector_intake_session",
    entityId: sessionId,
    userId,
    payload: {
      session_id: sessionId,
      profile_id,
      validation_ready,
      contradiction_score: contradictions.contradiction_score,
      missing_field_count: missingFields.missing_fields.length,
      ambiguity_count: ambiguity.ambiguity_flags.length,
    },
    idempotencyKey: `erector_intake_normalized:${sessionId}`,
  });

  if (validation_ready) {
    const [sessionRow] = await db
      .select({ blueprint_id: erectorIntakeSessions.blueprint_id })
      .from(erectorIntakeSessions)
      .where(eq(erectorIntakeSessions.id, sessionId))
      .limit(1);
    await updateBlueprintErectorState(sessionRow?.blueprint_id, "VALIDATION_REQUESTED");

    await writeEvent({
      eventType: EVENT_TYPES.ERECTOR_VALIDATION_REQUESTED,
      entityType: "erector_intake_session",
      entityId: sessionId,
      userId,
      payload: {
        session_id: sessionId,
        profile_id,
        tier,
      },
      idempotencyKey: `erector_validation_requested:${sessionId}`,
    });
  }

  return {
    profile_id,
    validation_ready,
    missing_fields: missingFields.missing_fields,
    ambiguity_flags: ambiguity.ambiguity_flags,
    contradiction_score: contradictions.contradiction_score,
  };
}
