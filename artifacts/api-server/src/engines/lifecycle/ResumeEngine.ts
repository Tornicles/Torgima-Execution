import {
  db,
  blueprints,
  blueprintMutations,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEventInTx, EVENT_TYPES } from "../../services/EventService.js";
import { mutate } from "../../services/StateMutationService.js";
import { TorgimaError } from "../../lib/errors.js";

export type ResumeMode = "normal" | "check_in" | "recovery" | "restart";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function deriveResumeModeFromDays(pauseGapDays: number): ResumeMode {
  if (pauseGapDays <= 2) return "normal";
  if (pauseGapDays <= 7) return "check_in";
  if (pauseGapDays <= 30) return "recovery";
  return "restart";
}

export async function resumeBlueprint(params: {
  blueprintId: string;
  userId: string;
}): Promise<{ resumeMode: ResumeMode; pauseGapDays: number }> {
  const [blueprint] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.id, params.blueprintId), eq(blueprints.user_id, params.userId)))
    .limit(1);

  if (!blueprint) throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);
  if (blueprint.status !== "paused") {
    throw new TorgimaError("BLUEPRINT_NOT_PAUSED", "Blueprint is not paused", false);
  }

  const pausedAt = blueprint.paused_at;
  const pauseGapMs = pausedAt ? Date.now() - pausedAt.getTime() : 0;
  const pauseGapDays = Math.floor(pauseGapMs / 86400000);

  const resumeMode = deriveResumeModeFromDays(pauseGapDays);

  const generationModeMap: Record<ResumeMode, string> = {
    normal: "post_feedback",
    check_in: "post_feedback",
    recovery: "recovery",
    restart: "recovery",
  };

  const generationMode = generationModeMap[resumeMode];

  const now = new Date();
  const expectedVersion = blueprint.state_version;

  await mutate({
    blueprintId: params.blueprintId,
    userId: params.userId,
    expectedVersion,
    mutationName: "blueprint_resumed",
    idempotencyKey: `blueprint_resumed:${params.blueprintId}:${now.getTime()}`,
    mutationFn: async (tx: Tx) => {
      await tx
        .update(blueprints)
        .set({
          status: "active",
          paused_at: null,
          pause_reason: null,
          active: true,
        })
        .where(eq(blueprints.id, params.blueprintId));

      await tx.insert(blueprintMutations).values({
        blueprint_id: params.blueprintId,
        mutation_type: "RESUME",
        layer: "blueprint",
        change_summary: `Blueprint resumed after ${pauseGapDays}d gap (mode: ${resumeMode})`,
        cascade_json: [],
        approved: true,
        approved_at: now,
      });

      await writeEventInTx(
        {
          eventType: EVENT_TYPES.BLUEPRINT_RESUMED,
          entityType: "blueprint",
          entityId: params.blueprintId,
          userId: params.userId,
          blueprintId: params.blueprintId,
          payload: {
            resume_mode: resumeMode,
            pause_gap_days: pauseGapDays,
            pause_gap_hours: pauseGapMs / 3600000,
          },
          idempotencyKey: `blueprint_resumed:${params.blueprintId}:${now.getTime()}`,
        },
        tx,
      );

      await writeEventInTx(
        {
          eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
          entityType: "blueprint",
          entityId: params.blueprintId,
          userId: params.userId,
          blueprintId: params.blueprintId,
          payload: {
            generation_mode: generationMode,
            generation_trigger: "blueprint_resumed",
            resume_mode: resumeMode,
            pause_gap_days: pauseGapDays,
          },
          idempotencyKey: `task_gen_resume:${params.blueprintId}:${now.getTime()}`,
        },
        tx,
      );

      if (pauseGapDays > 2) {
        await writeEventInTx(
          {
            eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
            entityType: "blueprint",
            entityId: params.blueprintId,
            userId: params.userId,
            blueprintId: params.blueprintId,
            payload: { trigger: "blueprint_resumed", resume_mode: resumeMode },
            idempotencyKey: `signal_resume:${params.blueprintId}:${now.getTime()}`,
          },
          tx,
        );
      }
    },
  });

  logger.info({ blueprintId: params.blueprintId, resumeMode, pauseGapDays }, "[ResumeEngine] Blueprint resumed");

  return { resumeMode, pauseGapDays };
}

export class ResumeEngine {
  resumeBlueprint(p: { blueprintId: string; userId: string }) {
    return resumeBlueprint(p);
  }
}
