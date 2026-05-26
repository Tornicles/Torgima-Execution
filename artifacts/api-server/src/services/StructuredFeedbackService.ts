import {
  activeFeedbackSessions,
  blueprints,
  db,
  feedback,
  orders,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { writeEvent, EVENT_TYPES } from "./EventService.js";
import {
  computeAllEngineMetrics,
  countCompletedSections,
  shouldShowReflectionSection,
  taskStateToCompletionStatus,
  taskStateToOrderStatus,
} from "../engines/feedback/StructuredFeedbackEngines.js";
import { interpretStructuredFeedback } from "../engines/feedback/StructuredFeedbackBhudhi.js";
import type {
  FeedbackEntryRoute,
  FeedbackTriggerType,
  StructuredFeedbackSubmitPayload,
  TaskStateEntry,
} from "../types/structured-feedback.js";
import { processFeedbackRegeneration } from "../engines/sequence/sequenceRegenerationEngine.js";
import { recalculatePermanentFrameworkSignals } from "./PermanentFrameworkSignalService.js";
import { SequenceTracker } from "../engines/sequence/SequenceTracker.js";
import { GrowthIntelligenceService } from "../engines/growth/GrowthIntelligenceService.js";
import { UltimateIntelligenceService } from "../engines/ultimate/UltimateIntelligenceService.js";

const OPEN_ORDER_STATUSES = ["pending", "active", "needs_feedback", "blocked"] as const;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export const StructuredFeedbackService = {
  async resolveEntryRoute(blueprintId: string, userId: string): Promise<FeedbackEntryRoute> {
    const unfinished = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          eq(orders.user_id, userId),
          inArray(orders.status, [...OPEN_ORDER_STATUSES]),
        ),
      );

    const [todaySession] = await db
      .select()
      .from(activeFeedbackSessions)
      .where(
        and(
          eq(activeFeedbackSessions.blueprint_id, blueprintId),
          eq(activeFeedbackSessions.user_id, userId),
          eq(activeFeedbackSessions.session_date, todayDateString()),
        ),
      )
      .orderBy(desc(activeFeedbackSessions.created_at))
      .limit(1);

    if (unfinished.length === 0) {
      if (todaySession?.completed_at) return "show_progress";
      return "show_dashboard";
    }

    const recent = await db
      .select({ execution_score: activeFeedbackSessions.execution_score })
      .from(activeFeedbackSessions)
      .where(
        and(
          eq(activeFeedbackSessions.blueprint_id, blueprintId),
          gte(activeFeedbackSessions.session_date, sql`CURRENT_DATE - interval '7 days'`),
        ),
      )
      .orderBy(desc(activeFeedbackSessions.session_date))
      .limit(7);

    const lowDays = recent.filter((r) => (r.execution_score ?? 1) < 0.5).length;
    const lastScore = recent[0]?.execution_score ?? 0.5;
    if (lowDays >= 3) return "reflection_mode";

    if (todaySession?.completed_at && unfinished.length === 0) return "show_progress";
    return "open_feedback";
  },

  async startSession(
    userId: string,
    blueprintId: string,
    triggerType: FeedbackTriggerType = "app_open",
  ) {
    const [bp] = await db
      .select()
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);
    if (!bp) throw new TorgimaError("NOT_FOUND", "Blueprint not found", false);

    const route = await this.resolveEntryRoute(blueprintId, userId);
    if (route === "show_dashboard" || route === "show_progress") {
      return { route, session: null, unfinishedOrders: [] };
    }

    const unfinishedOrders = await db
      .select({
        id: orders.id,
        title: orders.title,
        status: orders.status,
        task_state: orders.task_state,
      })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          eq(orders.user_id, userId),
          inArray(orders.status, [...OPEN_ORDER_STATUSES]),
        ),
      )
      .orderBy(orders.priority);

    const [existing] = await db
      .select()
      .from(activeFeedbackSessions)
      .where(
        and(
          eq(activeFeedbackSessions.blueprint_id, blueprintId),
          eq(activeFeedbackSessions.user_id, userId),
          eq(activeFeedbackSessions.session_date, todayDateString()),
          isNull(activeFeedbackSessions.completed_at),
        ),
      )
      .limit(1);

    const session =
      existing ??
      (
        await db
          .insert(activeFeedbackSessions)
          .values({
            user_id: userId,
            blueprint_id: blueprintId,
            trigger_type: triggerType,
            session_date: todayDateString(),
          })
          .returning()
      )[0];

    if (!session) throw new TorgimaError("INTERNAL_ERROR", "Could not start feedback session", true);

    const draft = session as typeof activeFeedbackSessions.$inferSelect;
    const sectionsCompleted = countCompletedSections(draft);
    const completionPreview =
      unfinishedOrders.length > 0
        ? unfinishedOrders.filter((o) => o.status === "completed").length / unfinishedOrders.length
        : 1;

    const showReflection = shouldShowReflectionSection({
      completionRate: completionPreview,
      recentLowDays: 0,
      momentum: 0,
    });

    return {
      route,
      session: {
        id: session.id,
        triggerType: session.trigger_type,
        dailyReality: session.daily_reality,
        realitySummary: session.reality_summary,
        taskStates: session.task_states,
        emotionalState: session.emotional_state,
        frictionType: session.friction_type,
        outputType: session.output_type,
        reflectionSignal: session.reflection_signal,
        sectionsCompleted,
        showReflectionSection: showReflection,
      },
      unfinishedOrders,
    };
  },

  async patchSection(
    sessionId: string,
    userId: string,
    section:
      | "a"
      | "b"
      | "c"
      | "d"
      | "e"
      | "f",
    body: Record<string, unknown>,
  ) {
    const [row] = await db
      .select()
      .from(activeFeedbackSessions)
      .where(and(eq(activeFeedbackSessions.id, sessionId), eq(activeFeedbackSessions.user_id, userId)))
      .limit(1);
    if (!row) throw new TorgimaError("NOT_FOUND", "Feedback session not found", false);
    if (row.completed_at) throw new TorgimaError("VALIDATION_ERROR", "Session already submitted", false);

    const patch: Partial<typeof activeFeedbackSessions.$inferInsert> = {};
    if (section === "a") {
      patch.daily_reality = body.dailyReality ?? body.daily_reality;
      patch.reality_summary = (body.realitySummary ?? body.reality_summary) as string | undefined;
    }
    if (section === "b") patch.task_states = body.taskStates ?? body.task_states;
    if (section === "c") patch.emotional_state = body.emotionalState ?? body.emotional_state;
    if (section === "d") patch.friction_type = body.frictionType ?? body.friction_type;
    if (section === "e") patch.output_type = body.outputType ?? body.output_type;
    if (section === "f") patch.reflection_signal = (body.reflectionSignal ?? body.reflection_signal) as string;

    await db.update(activeFeedbackSessions).set(patch).where(eq(activeFeedbackSessions.id, sessionId));
    return { updated: true, section };
  },

  async submitSession(userId: string, payload: StructuredFeedbackSubmitPayload) {
    const [row] = await db
      .select()
      .from(activeFeedbackSessions)
      .where(
        and(eq(activeFeedbackSessions.id, payload.sessionId), eq(activeFeedbackSessions.user_id, userId)),
      )
      .limit(1);
    if (!row) throw new TorgimaError("NOT_FOUND", "Feedback session not found", false);

    const taskStates = payload.taskStates as TaskStateEntry[];
    if (taskStates.length === 0) {
      throw new TorgimaError("VALIDATION_ERROR", "Task reality (section B) is required", false);
    }

    const assignedOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.blueprint_id, row.blueprint_id));

    const [prior] = await db
      .select({ execution_score: activeFeedbackSessions.execution_score })
      .from(activeFeedbackSessions)
      .where(
        and(
          eq(activeFeedbackSessions.blueprint_id, row.blueprint_id),
          isNotNull(activeFeedbackSessions.completed_at),
        ),
      )
      .orderBy(desc(activeFeedbackSessions.completed_at))
      .limit(1);

    const sectionsCompleted = Math.max(
      countCompletedSections({
        daily_reality: payload.dailyReality,
        reality_summary: payload.realitySummary,
        task_states: taskStates,
        emotional_state: payload.emotionalState,
        friction_type: payload.frictionType,
        output_type: payload.outputType,
        reflection_signal: payload.reflectionSignal,
      }),
      4,
    );

    const engineMetrics = computeAllEngineMetrics({
      taskStates,
      assignedCount: assignedOrders.length,
      outputs: payload.outputType,
      emotions: payload.emotionalState,
      frictions: payload.frictionType,
      reflection: payload.reflectionSignal,
      sectionsCompleted,
      priorExecutionScore: prior?.execution_score ?? undefined,
    });

    const [bp] = await db
      .select({ state_version: blueprints.state_version, tier: blueprints.tier })
      .from(blueprints)
      .where(eq(blueprints.id, row.blueprint_id))
      .limit(1);

    const bhudhi = await interpretStructuredFeedback({
      userId,
      blueprintId: row.blueprint_id,
      stateVersion: bp?.state_version ?? 0,
      sessionId: payload.sessionId,
      payload,
    });

    const signalSnapshot = {
      date: todayDateString(),
      execution_score: engineMetrics.final_execution_score,
      production_signal: engineMetrics.production_signal,
      operations_signal: engineMetrics.operations_signal,
      growth_signal: engineMetrics.growth_signal,
      scale_signal: engineMetrics.scale_signal,
      momentum: engineMetrics.momentum,
      confidence: engineMetrics.confidence,
    };

    await db
      .update(activeFeedbackSessions)
      .set({
        daily_reality: payload.dailyReality ?? [],
        reality_summary: payload.realitySummary ?? null,
        task_states: taskStates,
        emotional_state: payload.emotionalState,
        friction_type: payload.frictionType,
        output_type: payload.outputType,
        reflection_signal: payload.reflectionSignal ?? null,
        engine_metrics: engineMetrics,
        signal_snapshot: signalSnapshot,
        execution_score: engineMetrics.final_execution_score,
        confidence: engineMetrics.confidence,
        bhudhi_interpretation: bhudhi,
        completed_at: new Date(),
      })
      .where(eq(activeFeedbackSessions.id, payload.sessionId));

    for (const entry of taskStates) {
      const completionStatus = taskStateToCompletionStatus(entry.state);
      const orderStatus = taskStateToOrderStatus(entry.state);
      const carryOver = !["Finished", "Skipped"].includes(entry.state);

      await db
        .update(orders)
        .set({
          task_state: entry.state,
          carry_over: carryOver,
          last_feedback_at: new Date(),
          status: orderStatus as typeof orders.$inferInsert["status"],
          ...(entry.state === "Finished"
            ? { completed_at: new Date(), finished_at: new Date() }
            : {}),
        })
        .where(and(eq(orders.id, entry.task_id), eq(orders.blueprint_id, row.blueprint_id)));

      const reflectionText =
        payload.realitySummary?.trim() ||
        `Structured feedback: ${entry.state} — ${payload.emotionalState.join(", ")}`;

      await db.insert(feedback).values({
        order_id: entry.task_id,
        blueprint_id: row.blueprint_id,
        user_id: userId,
        completion_status: completionStatus,
        score: null,
        weighted_score: engineMetrics.final_execution_score * 10,
        reflection: reflectionText.slice(0, 2000),
        friction_score: Math.abs(engineMetrics.energy_score) * 10,
        confidence_score: engineMetrics.confidence * 10,
        proof_json: { structured_session_id: payload.sessionId, task_state: entry.state },
        blocker_json:
          entry.state === "Blocked"
            ? { friction: payload.frictionType }
            : payload.frictionType.length
              ? { friction: payload.frictionType }
              : {},
      });
    }

    await recalculatePermanentFrameworkSignals({
      blueprintId: row.blueprint_id,
      userId,
    }).catch(() => null);

    const eventId = await writeEvent({
      eventType: EVENT_TYPES.FEEDBACK_SUBMITTED,
      entityType: "active_feedback_session",
      entityId: payload.sessionId,
      userId,
      blueprintId: row.blueprint_id,
      payload: {
        structured: true,
        execution_score: engineMetrics.final_execution_score,
        signal_snapshot: signalSnapshot,
        feedback_session_id: payload.sessionId,
      },
      idempotencyKey: `structured_feedback_submit:${payload.sessionId}`,
    });

    await writeEvent({
      eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
      entityType: "active_feedback_session",
      entityId: payload.sessionId,
      userId,
      blueprintId: row.blueprint_id,
      payload: {
        trigger: "structured_feedback_submitted",
        execution_score: engineMetrics.final_execution_score,
        structured_session_id: payload.sessionId,
      },
      idempotencyKey: `signal_recalc:structured:${payload.sessionId}`,
      causationEventId: eventId,
    });

    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "active_feedback_session",
      entityId: payload.sessionId,
      userId,
      blueprintId: row.blueprint_id,
      payload: {
        generation_mode: "post_feedback",
        generation_trigger: "structured_feedback_submitted",
        queue_fill: true,
      },
      idempotencyKey: `task_gen:structured:${payload.sessionId}`,
      causationEventId: eventId,
    });

    await processFeedbackRegeneration({
      blueprintId: row.blueprint_id,
      userId,
      tier: bp?.tier,
      completion: engineMetrics.completion_rate >= 0.7 ? "completed" : "partial",
      score: engineMetrics.final_execution_score * 10,
      reflection: payload.realitySummary,
    }).catch(() => null);

    await SequenceTracker.recordCheckpoint(row.blueprint_id, 19, {
      userAction: "Feedback submitted",
      stateSnapshot: {
        session_id: payload.sessionId,
        execution_score: engineMetrics.final_execution_score,
        signal_snapshot: signalSnapshot,
      },
      validationPassed: true,
    }).catch(() => null);
    await SequenceTracker.advanceSequence(row.blueprint_id, "Feedback received").catch(() => null);
    await SequenceTracker.recordCheckpoint(row.blueprint_id, 20, {
      userAction: "Signal calculation after feedback",
      stateSnapshot: signalSnapshot,
      validationPassed: true,
    }).catch(() => null);

    const growthIntel = await GrowthIntelligenceService.runAfterFeedback(
      row.blueprint_id,
      bp?.tier,
    ).catch(() => ({ skipped: true }));

    const ultimateIntel = await UltimateIntelligenceService.runAfterFeedback(
      row.blueprint_id,
      userId,
    ).catch(() => ({ skipped: true }));

    const userMessage =
      engineMetrics.growth_signal < 0.5
        ? "Your execution today showed good effort but some friction. Adjusting to support you with more operations focus."
        : "Thanks for sharing what happened today. Your blueprint is adapting from this reality.";

    return {
      submitted: true,
      executionScoreHidden: true,
      signals: {
        production: engineMetrics.production_signal,
        operations: engineMetrics.operations_signal,
        growth: engineMetrics.growth_signal,
        scale: engineMetrics.scale_signal,
      },
      conditionPending: true,
      message: userMessage,
      signalSnapshot,
      growth: growthIntel,
      ultimate: ultimateIntel,
    };
  },

  async getTodaySignals(blueprintId: string, userId: string) {
    const [session] = await db
      .select()
      .from(activeFeedbackSessions)
      .where(
        and(
          eq(activeFeedbackSessions.blueprint_id, blueprintId),
          eq(activeFeedbackSessions.user_id, userId),
          eq(activeFeedbackSessions.session_date, todayDateString()),
          isNotNull(activeFeedbackSessions.completed_at),
        ),
      )
      .orderBy(desc(activeFeedbackSessions.completed_at))
      .limit(1);

    if (!session?.signal_snapshot) {
      return { date: todayDateString(), signals: null };
    }
    return { date: todayDateString(), signals: session.signal_snapshot };
  },
};
