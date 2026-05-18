import { db, blueprints, orders, morningReports } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { generateNextTask } from "./generateNextTask.js";
import { routeTrigger } from "../../bhudhi/TriggerRouter.js";
import { getWorldModel } from "../world-model/WorldModelEngine.js";
import { detectInactivity } from "../../bhudhi/agents/BehavioralAgent.js";
import { getPendingProposals } from "../governance/GovernanceService.js";

export interface DailyLoopResult {
  activeOrder: typeof orders.$inferSelect | null;
  morningReport: typeof morningReports.$inferSelect | null;
  pendingProposals: unknown[];
  stateExplanation: unknown;
}

export async function runDailyLoop(userId: string): Promise<DailyLoopResult> {
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);

  if (!bp) {
    return {
      activeOrder: null,
      morningReport: null,
      pendingProposals: [],
      stateExplanation: null,
    };
  }

  let activeOrder: typeof orders.$inferSelect | null =
    (
      await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.user_id, userId),
            eq(orders.blueprint_id, bp.id),
            eq(orders.status, "pre_generated"),
          ),
        )
        .orderBy(desc(orders.created_at))
        .limit(1)
    )[0] ?? null;

  if (!activeOrder) {
    const pending =
      (
        await db
          .select()
          .from(orders)
          .where(
            and(eq(orders.user_id, userId), eq(orders.blueprint_id, bp.id), eq(orders.status, "pending")),
          )
          .orderBy(desc(orders.created_at))
          .limit(1)
      )[0] ?? null;
    activeOrder = pending;
  }

  if (!activeOrder) {
    const gen = await generateNextTask(userId, {
      blueprintId: bp.id,
      reason: "DAILY_LOGIN",
      generationMode: "daily",
    });
    activeOrder = gen.order;
  }

  const reportDate = new Date().toISOString().slice(0, 10);
  const [morningReport] = await db
    .select()
    .from(morningReports)
    .where(and(eq(morningReports.user_id, userId), eq(morningReports.report_date, reportDate)))
    .limit(1);

  const pendingProposals = await getPendingProposals(bp.id).catch(() => []);

  const world = await getWorldModel(userId);
  const stateExplanation = await routeTrigger({
    userId,
    blueprintId: bp.id,
    triggerType: "STATE_EXPLANATION",
    worldStateVersion: world?.stateVersion ?? bp.state_version ?? 0,
    currentCondition: bp.current_condition ?? "stability",
    priority: "MEDIUM",
    payload: {
      condition: bp.current_condition,
      goal: bp.goal,
    },
  }).catch(() => null);

  const inactivity = await detectInactivity(userId);
  if (inactivity.isInactive && inactivity.inactiveHours > 24) {
    await routeTrigger({
      userId,
      blueprintId: bp.id,
      triggerType: "INACTIVITY_RESTART",
      worldStateVersion: world?.stateVersion ?? 0,
      currentCondition: bp.current_condition ?? "stability",
      priority: "HIGH",
      payload: {
        goal: bp.goal,
        daysInactive: Math.floor(inactivity.inactiveHours / 24),
        bestStreak: 0,
      },
    }).catch(() => null);
  }

  return {
    activeOrder: activeOrder ?? null,
    morningReport: morningReport ?? null,
    pendingProposals,
    stateExplanation: stateExplanation?.contextPacket ?? null,
  };
}
