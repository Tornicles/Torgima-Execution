/**
 * Prompt 9 §2 — required E2E fixtures (real Postgres only).
 */
import {
  db,
  users,
  blueprints,
  orders,
  signalSnapshots,
  conditions,
  enforcementPackages,
  stateMemory,
  validations,
  falseProgressFlags,
  events,
  deadLetterEvents,
  systemHealthLogs,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { createTestUser, createTestBlueprint, createInitialState, createTestOrder } from "./db.js";

export type Phase9FixtureName =
  | "new_user_minimal"
  | "stable_user_active"
  | "danger_user_restricted"
  | "stale_projection_user"
  | "feedback_conflict_user"
  | "event_retry_user"
  | "dlq_user"
  | "false_progress_user"
  | "inactivity_user"
  | "pivot_required_user";

export interface Phase9Fixture {
  name: Phase9FixtureName;
  userId: string;
  blueprintId?: string;
  orderId?: string;
  trace: { runId: string; fixture: Phase9FixtureName };
}

const runId = () => `phase9-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function seedPhase9Fixture(name: Phase9FixtureName): Promise<Phase9Fixture> {
  const id = runId();
  const trace = { runId: id, fixture: name };

  switch (name) {
    case "new_user_minimal": {
      const user = await createTestUser({ display_name: "P9 New User" });
      return { name, userId: user.id, trace };
    }

    case "stable_user_active": {
      const user = await createTestUser({ display_name: "P9 Stable Active" });
      const bp = await createTestBlueprint(user.id, {
        status: "active",
        active: true,
        current_condition: "stability",
      });
      await createInitialState(bp.id, user.id);
      await db
        .update(conditions)
        .set({ condition: "stability", is_current: true })
        .where(and(eq(conditions.blueprint_id, bp.id), eq(conditions.is_current, true)));
      await db
        .update(enforcementPackages)
        .set({ condition: "stability", difficulty_cap: "moderate" })
        .where(and(eq(enforcementPackages.blueprint_id, bp.id), eq(enforcementPackages.is_current, true)));
      const order = await createTestOrder(bp.id, user.id, { status: "pending", difficulty: "easy" });
      return { name, userId: user.id, blueprintId: bp.id, orderId: order.id, trace };
    }

    case "danger_user_restricted": {
      const user = await createTestUser({ display_name: "P9 Danger" });
      const bp = await createTestBlueprint(user.id, {
        status: "active",
        active: true,
        current_condition: "danger",
      });
      await createInitialState(bp.id, user.id);
      await db
        .update(conditions)
        .set({ condition: "danger", recovery_required: true })
        .where(and(eq(conditions.blueprint_id, bp.id), eq(conditions.is_current, true)));
      await db
        .update(enforcementPackages)
        .set({
          condition: "danger",
          difficulty_cap: "easy",
          task_limits: { min: 1, max: 1 },
          ai_mode: "stabilization",
        })
        .where(and(eq(enforcementPackages.blueprint_id, bp.id), eq(enforcementPackages.is_current, true)));
      const order = await createTestOrder(bp.id, user.id, {
        status: "pending",
        difficulty: "hard",
        task_type: "execution",
      });
      return { name, userId: user.id, blueprintId: bp.id, orderId: order.id, trace };
    }

    case "stale_projection_user": {
      const user = await createTestUser({ display_name: "P9 Stale Projection" });
      const bp = await createTestBlueprint(user.id, {
        status: "active",
        active: true,
        state_version: 5,
      });
      await createInitialState(bp.id, user.id);
      await createTestOrder(bp.id, user.id, { status: "pending" });
      await db.update(blueprints).set({ state_version: 10 }).where(eq(blueprints.id, bp.id));
      return { name, userId: user.id, blueprintId: bp.id, trace };
    }

    case "feedback_conflict_user": {
      const user = await createTestUser({ display_name: "P9 Feedback Conflict" });
      const bp = await createTestBlueprint(user.id, { status: "active", active: true });
      await createInitialState(bp.id, user.id);
      const order = await createTestOrder(bp.id, user.id, {
        status: "active",
        proof_required: true,
        started_at: new Date(),
      });
      return { name, userId: user.id, blueprintId: bp.id, orderId: order.id, trace };
    }

    case "false_progress_user": {
      const user = await createTestUser({ display_name: "P9 False Progress" });
      const bp = await createTestBlueprint(user.id, { status: "active", active: true });
      await createInitialState(bp.id, user.id);
      await db.insert(falseProgressFlags).values({
        user_id: user.id,
        blueprint_id: bp.id,
        detection_type: "activity_without_outcome",
        severity: "high",
        evidence_json: { completions: 12, movement: 0 },
        resolved: false,
      });
      const order = await createTestOrder(bp.id, user.id, { status: "pending" });
      return { name, userId: user.id, blueprintId: bp.id, orderId: order.id, trace };
    }

    case "event_retry_user": {
      const user = await createTestUser({ display_name: "P9 Event Retry" });
      const bp = await createTestBlueprint(user.id, { status: "active", active: true });
      await createInitialState(bp.id, user.id);
      const [ev] = await db
        .insert(events)
        .values({
          event_type: "feedback_processed",
          entity_type: "feedback",
          entity_id: "00000000-0000-4000-8000-000000000099",
          user_id: user.id,
          blueprint_id: bp.id,
          status: "pending",
          retry_count: 0,
          max_retries: 3,
          payload: { fixture: "event_retry_user" },
          idempotency_key: `${id}:retry-event`,
        })
        .returning({ id: events.id });
      return { name, userId: user.id, blueprintId: bp.id, orderId: ev?.id, trace };
    }

    case "dlq_user": {
      const user = await createTestUser({ display_name: "P9 DLQ" });
      const bp = await createTestBlueprint(user.id, { status: "active", active: true });
      await createInitialState(bp.id, user.id);
      const [ev] = await db
        .insert(events)
        .values({
          event_type: "signal_recalculation_requested",
          entity_type: "blueprint",
          entity_id: bp.id,
          user_id: user.id,
          blueprint_id: bp.id,
          status: "dead_lettered",
          retry_count: 4,
          max_retries: 3,
          payload: { fixture: "dlq_user" },
          idempotency_key: `${id}:dlq-event`,
        })
        .returning({ id: events.id });
      await db.insert(deadLetterEvents).values({
        original_event_id: ev!.id,
        event_type: "signal_recalculation_requested",
        blueprint_id: bp.id,
        user_id: user.id,
        payload: { fixture: "dlq_user" },
        failure_reason: "exhausted retries",
        failure_class: "transient",
        resolution_status: "OPEN",
        retry_count: 4,
      });
      await db.insert(systemHealthLogs).values({
        blueprint_id: bp.id,
        check_type: "EVENT_SYSTEM",
        status: "degraded",
        details_json: { eventId: ev!.id, severity: "ERROR", message: "Dead letter backlog for E2E fixture" },
        issues_detected: ["DLQ_BACKLOG"],
      });
      return { name, userId: user.id, blueprintId: bp.id, orderId: ev?.id, trace };
    }

    case "inactivity_user": {
      const user = await createTestUser({
        display_name: "P9 Inactivity",
        commitment_level: "high",
      });
      const bp = await createTestBlueprint(user.id, { status: "active", active: true });
      await createInitialState(bp.id, user.id);
      await createTestOrder(bp.id, user.id, { status: "pending" });
      await db
        .update(blueprints)
        .set({ created_at: new Date(Date.now() - 10 * 86400000) })
        .where(eq(blueprints.id, bp.id));
      return { name, userId: user.id, blueprintId: bp.id, trace };
    }

    case "pivot_required_user": {
      const user = await createTestUser({ display_name: "P9 Pivot Required" });
      const bp = await createTestBlueprint(user.id, {
        status: "path_selection",
        active: false,
      });
      const [val] = await db
        .insert(validations)
        .values({
          user_id: user.id,
          blueprint_id: bp.id,
          raw_goal: "Pivot validation fixture goal",
          purpose: "Exercise pivot validation state",
          timeframe: "90 days",
          timeframe_days: 90,
          commitment_level: "medium",
          selected_blueprint_tier: "starter",
          selected_blueprint_mode: "individual",
          status: "complete",
          verdict: "pivot",
          launch_blocked: true,
          path_current: { title: "Current", summary: "x", rationale: "y", riskLevel: "high", planSkeleton: {} },
          intelligence_payload: {
            verdictReasoning: "Demand signal too weak for this goal.",
            pis: { risk_flags: [{ level: "critical", resolvable: false, message: "Market fit" }] },
          },
        })
        .returning({ id: validations.id });
      await db.update(blueprints).set({ validation_id: val!.id }).where(eq(blueprints.id, bp.id));
      return { name, userId: user.id, blueprintId: bp.id, trace };
    }

    default:
      throw new Error(`Unknown fixture: ${name satisfies never}`);
  }
}

export async function cleanupPhase9User(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}
