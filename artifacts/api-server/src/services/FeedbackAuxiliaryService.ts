import {
  db,
  blueprints,
  weeklyReviews,
  phaseCheckpoints,
  habits,
  habitCheckins,
  phases,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { writeEvent, EVENT_TYPES } from "./EventService.js";
import { dispatchPendingEvents } from "./EventDispatcher.js";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import {
  outcomeValidationEngine,
  assertPhaseAdvancementAllowed,
} from "../engines/outcome/OutcomeValidationEngine.js";

const blueprintEngine = new BlueprintEngine();

export function currentUtcWeekBounds(d = new Date()): { start: Date; end: Date } {
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export const FeedbackAuxiliaryService = {
  async submitWeeklyReview(
    userId: string,
    input: {
      blueprintId: string;
      wins: string;
      failures?: string;
      patterns?: string;
      nextFocus: string;
      idempotencyKey: string;
    },
  ): Promise<{ reviewId: string }> {
    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(
        and(
          eq(blueprints.id, input.blueprintId),
          eq(blueprints.user_id, userId),
          eq(blueprints.active, true),
        ),
      )
      .limit(1);

    if (!bp) {
      throw new TorgimaError("NOT_FOUND", "Active blueprint not found", false);
    }

    const { start: weekStart, end: weekEnd } = currentUtcWeekBounds();

    const [review] = await db
      .insert(weeklyReviews)
      .values({
        blueprint_id: input.blueprintId,
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd,
        wins: input.wins,
        failures: input.failures ?? null,
        patterns: input.patterns ?? null,
        next_focus: input.nextFocus,
      })
      .returning({ id: weeklyReviews.id });

    if (!review) {
      throw new TorgimaError("INTERNAL_ERROR", "Failed to create review", false);
    }

    await writeEvent({
      eventType: EVENT_TYPES.OUTCOME_VALIDATION_REQUESTED,
      entityType: "weekly_review",
      entityId: review.id,
      userId,
      blueprintId: input.blueprintId,
      payload: { trigger: "weekly_review", phase: "weekly" },
      idempotencyKey: `outcome_validation:weekly:${review.id}`,
    });

    await writeEvent({
      eventType: EVENT_TYPES.FEEDBACK_SUBMITTED,
      entityType: "weekly_review",
      entityId: review.id,
      userId,
      blueprintId: input.blueprintId,
      payload: {
        feedback_kind: "weekly_review",
        weekly_review_id: review.id,
        generation_context: "weekly_review_submitted",
        requires_interrogation: false,
      },
      idempotencyKey: `feedback_submitted:weekly_review:${review.id}:${input.idempotencyKey}`,
    });

    await dispatchPendingEvents().catch(() => null);

    return { reviewId: review.id };
  },

  async submitPhaseCheckpoint(
    userId: string,
    input: {
      blueprintId: string;
      phaseId: string;
      outcomes: string;
      evidence: string;
      blockers?: string;
      risks?: string;
      readiness: "ready" | "not_ready" | "needs_review";
      idempotencyKey: string;
    },
  ): Promise<{ checkpointId: string | undefined; phaseAdvanced: boolean }> {
    const [phase] = await db
      .select({ id: phases.id })
      .from(phases)
      .where(and(eq(phases.id, input.phaseId), eq(phases.blueprint_id, input.blueprintId)))
      .limit(1);

    if (!phase) {
      throw new TorgimaError("NOT_FOUND", "Phase not found", false);
    }

    const [checkpoint] = await db
      .insert(phaseCheckpoints)
      .values({
        blueprint_id: input.blueprintId,
        phase_id: input.phaseId,
        user_id: userId,
        outcomes_achieved: input.outcomes,
        evidence_summary: input.evidence,
        bottlenecks: input.blockers ?? null,
        next_risks: input.risks ?? null,
        readiness: input.readiness,
        evaluated_at: new Date(),
      })
      .returning({ id: phaseCheckpoints.id });

    const [phaseRow] = await db
      .select({ name: phases.name })
      .from(phases)
      .where(eq(phases.id, input.phaseId))
      .limit(1);

    await writeEvent({
      eventType: EVENT_TYPES.OUTCOME_VALIDATION_REQUESTED,
      entityType: "phase_checkpoint",
      entityId: checkpoint?.id ?? input.phaseId,
      userId,
      blueprintId: input.blueprintId,
      payload: {
        trigger: "phase_checkpoint",
        phase: phaseRow?.name ?? input.phaseId,
      },
      idempotencyKey: `outcome_validation:phase:${input.phaseId}:${input.idempotencyKey}`,
    });

    let phaseAdvanced = false;
    if (input.readiness === "ready") {
      await outcomeValidationEngine.validate({
        userId,
        blueprintId: input.blueprintId,
        phase: phaseRow?.name,
        trigger: "phase_checkpoint",
      });
      await assertPhaseAdvancementAllowed(input.blueprintId, userId);
      const adv = await blueprintEngine.advanceBlueprintPosition(input.blueprintId, userId);
      phaseAdvanced = adv.advanced;

      await writeEvent({
        eventType: EVENT_TYPES.FEEDBACK_SUBMITTED,
        entityType: "phase_checkpoint",
        entityId: checkpoint?.id ?? input.phaseId,
        userId,
        blueprintId: input.blueprintId,
        payload: {
          feedback_kind: "phase_checkpoint",
          phase_checkpoint_id: checkpoint?.id ?? input.phaseId,
          phase_id: input.phaseId,
          generation_context: "phase_completed",
          readiness: input.readiness,
          requires_interrogation: false,
        },
        idempotencyKey: `feedback_submitted:phase_checkpoint:${input.phaseId}:${input.idempotencyKey}`,
      });

      await dispatchPendingEvents().catch(() => null);
    }

    return { checkpointId: checkpoint?.id, phaseAdvanced };
  },

  async submitHabitCheckin(
    userId: string,
    input: {
      blueprintId: string;
      habitId: string;
      completed: boolean;
      effortScore: number;
      notes?: string;
    },
  ): Promise<{ checkinId: string | undefined }> {
    const [habit] = await db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.id, input.habitId),
          eq(habits.user_id, userId),
          eq(habits.blueprint_id, input.blueprintId),
        ),
      )
      .limit(1);

    if (!habit) {
      throw new TorgimaError("NOT_FOUND", "Habit not found", false);
    }

    const [checkin] = await db
      .insert(habitCheckins)
      .values({
        habit_id: input.habitId,
        blueprint_id: input.blueprintId,
        user_id: userId,
        completed: input.completed,
        effort_score: input.effortScore,
        note: input.notes ?? null,
      })
      .returning({ id: habitCheckins.id });

    if (input.completed) {
      await db
        .update(habits)
        .set({ streak_count: habit.streak_count + 1 })
        .where(eq(habits.id, input.habitId))
        .catch(() => null);
    } else {
      await db
        .update(habits)
        .set({ streak_count: 0 })
        .where(eq(habits.id, input.habitId))
        .catch(() => null);
    }

    return { checkinId: checkin?.id };
  },
};
