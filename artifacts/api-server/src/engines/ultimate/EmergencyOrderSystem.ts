import { blueprints, db, orders, ultimateEmergencyOrders } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { OrderStatus } from "@workspace/state-machine";
import { ULTIMATE_SEQUENCE_NUMBER } from "./ultimateGate.js";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

async function currentSequenceNumber(blueprintId: string): Promise<number> {
  const [row] = await db
    .select({ current_sequence_number: blueprints.current_sequence_number })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return row?.current_sequence_number ?? ULTIMATE_SEQUENCE_NUMBER;
}

export const EmergencyOrderSystem = {
  async createBlockerResolutionOrder(blueprintId: string, userId: string, blocker: string) {
    const seq = await currentSequenceNumber(blueprintId);
    const description = `Resolve blocker: ${blocker}`;

    const [linked] = await db
      .insert(orders)
      .values({
        blueprint_id: blueprintId,
        user_id: userId,
        task_type: "recovery",
        title: `URGENT: ${blocker.slice(0, 80)}`,
        instruction: `URGENT: ${blocker} — Resolution Required`,
        expected_output: "Blocker resolved or escalated with proof",
        definition_of_done: "Can continue to next task without this blocker",
        why_it_matters: "Blocking all forward progress on your blueprint",
        time_estimate_minutes: 30,
        proof_required: false,
        difficulty: "moderate",
        priority: 1,
        status: OrderStatus.PENDING,
        is_visible: true,
        order_type: "emergency",
        generation_reason: "ultimate_blocker_resolution",
      })
      .returning({ id: orders.id });

    const [emergency] = await db
      .insert(ultimateEmergencyOrders)
      .values({
        blueprint_id: blueprintId,
        sequence_number: seq,
        trigger_event: "blocker_detected",
        order_type: "blocker_resolution",
        task_description: description,
        urgency: "immediate",
        estimated_impact: "Unblock critical execution path",
        status: "pending",
        linked_order_id: linked?.id ?? null,
      })
      .returning();

    return { emergency: emergency!, linkedOrderId: linked?.id };
  },

  async createOpportunityOrder(blueprintId: string, opportunity: string) {
    const [emergency] = await db
      .insert(ultimateEmergencyOrders)
      .values({
        blueprint_id: blueprintId,
        sequence_number: await currentSequenceNumber(blueprintId),
        trigger_event: "opportunity_identified",
        order_type: "opportunity",
        task_description: `Seize opportunity: ${opportunity}`,
        urgency: "high",
        estimated_impact: "Accelerate progress",
        status: "pending",
      })
      .returning();

    return emergency!;
  },

  async createRecoveryOrder(blueprintId: string, userId: string, recoveryType: string) {
    const [bp] = await db
      .select({ goal: blueprints.goal })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);

    const [linked] = await db
      .insert(orders)
      .values({
        blueprint_id: blueprintId,
        user_id: userId,
        task_type: "recovery",
        title: "Ultimate recovery checkpoint",
        instruction: `Recovery (${recoveryType}): take one concrete step toward "${(bp?.goal ?? "your goal").slice(0, 120)}" and submit feedback.`,
        expected_output: "One recovery action completed",
        definition_of_done: "Feedback submitted for recovery order",
        why_it_matters: "Continuous validation flagged recovery need",
        time_estimate_minutes: 25,
        proof_required: false,
        difficulty: "easy",
        priority: 2,
        status: OrderStatus.PENDING,
        is_visible: true,
        order_type: "emergency",
        generation_reason: "ultimate_recovery",
      })
      .returning({ id: orders.id });

    const [emergency] = await db
      .insert(ultimateEmergencyOrders)
      .values({
        blueprint_id: blueprintId,
        sequence_number: await currentSequenceNumber(blueprintId),
        trigger_event: "recovery_needed",
        order_type: "recovery",
        task_description: `Recovery: ${recoveryType}`,
        urgency: "high",
        estimated_impact: "Restore execution validity",
        status: "pending",
        linked_order_id: linked?.id ?? null,
      })
      .returning();

    return { emergency: emergency!, linkedOrderId: linked?.id };
  },

  async completeEmergencyOrder(emergencyOrderId: string, effectiveness: number) {
    const [updated] = await db
      .update(ultimateEmergencyOrders)
      .set({
        status: "completed",
        completed_at: new Date(),
        effectiveness: clamp01(effectiveness),
      })
      .where(eq(ultimateEmergencyOrders.id, emergencyOrderId))
      .returning();
    return updated ?? null;
  },

  async dismissEmergencyOrder(emergencyOrderId: string) {
    const [updated] = await db
      .update(ultimateEmergencyOrders)
      .set({ status: "dismissed" })
      .where(eq(ultimateEmergencyOrders.id, emergencyOrderId))
      .returning();
    return updated ?? null;
  },

  async getPendingOrders(blueprintId: string) {
    return db
      .select()
      .from(ultimateEmergencyOrders)
      .where(
        and(
          eq(ultimateEmergencyOrders.blueprint_id, blueprintId),
          eq(ultimateEmergencyOrders.status, "pending"),
        ),
      )
      .orderBy(desc(ultimateEmergencyOrders.created_at));
  },
};
