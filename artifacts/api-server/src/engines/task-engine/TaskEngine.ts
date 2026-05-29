/**
 * TASK_ENGINE_SPECIFICATION.md — generation, allocation, visibility, mutation, continuity.
 */
import { blueprints, db, orders, plans } from "@workspace/db";
import { and, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import { OrderStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { generate } from "../task-generation/TaskGenerationEngine.js";
import {
  distributeDailyTaskCounts,
  getAllocationForCondition,
  mapPlanNameToMiniPlan,
  type MiniPlanKey,
} from "../mini-plan/MiniPlanAllocationEngine.js";
import { dailyTasksForCondition } from "../../constants/conditionSpec.js";
import { syncTaskGenerationSequence } from "../sequence/sequenceTaskQueueService.js";
import type { BlueprintTierKey, TaskQueueSnapshot, TaskScheduleOptions } from "../../types/task-engine.js";
import { buildQueueDayPattern } from "../mini-plan/MiniPlanAllocationEngine.js";

const MAX_GENERATIONS_PER_RUN = 18;

/** Build schedule slots from per-mini counts (spec allocation rounding). */
export function buildSlotsFromCounts(
  dayOffset: number,
  counts: Record<MiniPlanKey, number>,
): TaskScheduleOptions[] {
  const slots: TaskScheduleOptions[] = [];
  for (const mini of ["Foundation", "Operations", "Growth"] as const) {
    const n = counts[mini] ?? 0;
    for (let i = 0; i < n; i++) {
      slots.push({ dayOffset, miniPlanKey: mini });
    }
  }
  return slots;
}

export function generationModeForCondition(
  condition: string,
  fallback: string,
): string {
  const key = condition.toLowerCase().replace(/\s+/g, "_");
  if (key === "danger") return "recovery";
  return fallback;
}

function miniPlanLetter(key: string | null): string {
  if (key === "Foundation") return "F";
  if (key === "Growth") return "G";
  return "O";
}

export function hiddenHorizonDays(tier: BlueprintTierKey): number {
  if (tier === "growth") return 28;
  if (tier === "ultimate") return 56;
  return 14;
}

export function dailyTaskTotalForCondition(condition: string): number {
  return dailyTasksForCondition(condition);
}

function tierKey(tier?: string | null): BlueprintTierKey {
  if (tier === "growth" || tier === "ultimate") return tier;
  return "starter";
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function addUtcDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setUTCDate(n.getUTCDate() + days);
  return n;
}

export function buildInstructionFromAction(action: {
  name?: string | null;
  description?: string | null;
}): {
  instruction: string;
  expected_output: string;
  definition_of_done: string;
  why_it_matters: string;
} {
  const name = action.name ?? "Complete the next action";
  const desc = action.description ?? "Move execution forward on your blueprint.";
  return {
    instruction: `${name} with a concrete method and verifiable output, because ${desc.slice(0, 200)}`,
    expected_output: `One completed artifact for "${name}", including specifics from the action, ready for the next step.`,
    definition_of_done: `"${name}" is complete when objective criteria are met, nothing critical is missing, and handoff is possible.`,
    why_it_matters: desc.slice(0, 400),
  };
}

export function estimateMinutesForMiniPlan(miniPlan: MiniPlanKey): number {
  if (miniPlan === "Foundation") return 60;
  if (miniPlan === "Growth") return 90;
  return 75;
}

async function resolvePlanId(blueprintId: string, miniPlanKey: MiniPlanKey): Promise<string | undefined> {
  const planRows = await db.select({ id: plans.id, name: plans.name }).from(plans).where(eq(plans.blueprint_id, blueprintId));
  const match = planRows.find((p) => mapPlanNameToMiniPlan(p.name) === miniPlanKey);
  return match?.id;
}

export async function revealDueTasks(blueprintId?: string): Promise<number> {
  const now = new Date();
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        blueprintId ? eq(orders.blueprint_id, blueprintId) : sql`true`,
        eq(orders.is_visible, false),
        lte(orders.visibility_date, now),
        inArray(orders.status, ["pre_generated", "pending"]),
      ),
    );

  if (rows.length === 0) return 0;

  await db
    .update(orders)
    .set({ is_visible: true, status: "pending" })
    .where(inArray(orders.id, rows.map((r) => r.id)));

  logger.info({ count: rows.length, blueprintId }, "[TaskEngine] Tasks revealed for visibility date");
  return rows.length;
}

export async function getTaskQueueSnapshot(
  blueprintId: string,
  userId: string,
): Promise<TaskQueueSnapshot> {
  const [bp] = await db
    .select({ tier: blueprints.tier, current_condition: blueprints.current_condition })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  const condition = bp?.current_condition ?? "stability";
  const allocation = getAllocationForCondition(condition);
  const dailyTotal = dailyTaskTotalForCondition(condition);
  const todayStart = startOfUtcDay(new Date());

  const all = await db
    .select({
      id: orders.id,
      title: orders.title,
      status: orders.status,
      is_visible: orders.is_visible,
      visibility_date: orders.visibility_date,
      mini_plan_key: orders.mini_plan_key,
    })
    .from(orders)
    .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.user_id, userId)));

  const visibleToday = all.filter(
    (o) =>
      o.is_visible &&
      (!o.visibility_date || o.visibility_date <= new Date()) &&
      ["pending", "active", "needs_feedback"].includes(o.status),
  );

  const hiddenOrders = all.filter(
    (o) =>
      !o.is_visible ||
      o.status === OrderStatus.PRE_GENERATED ||
      o.status === OrderStatus.PENDING,
  );

  const hiddenByDayMap = new Map<number, string[]>();
  for (const o of hiddenOrders) {
    if (!o.visibility_date) continue;
    const vis = new Date(o.visibility_date);
    const today = startOfUtcDay(new Date());
    const dayOffset = Math.round((vis.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (dayOffset < 1) continue;
    const arr = hiddenByDayMap.get(dayOffset) ?? [];
    arr.push(miniPlanLetter(o.mini_plan_key));
    hiddenByDayMap.set(dayOffset, arr);
  }

  const dailyTaskCounts = distributeDailyTaskCounts(dailyTotal, allocation);
  const defaultPattern = buildQueueDayPattern(dailyTaskCounts);
  const horizon = hiddenHorizonDays(tierKey(bp?.tier));

  const hiddenByDay: TaskQueueSnapshot["hiddenByDay"] = [];
  for (let d = 1; d <= Math.min(7, horizon); d++) {
    const pattern = hiddenByDayMap.get(d) ?? defaultPattern;
    const dateKey = addUtcDays(todayStart, d).toISOString().slice(0, 10);
    hiddenByDay.push({ dayOffset: d, dateKey, count: pattern.length, pattern });
  }

  return {
    visibleToday: visibleToday.map((o) => ({
      id: o.id,
      title: o.title,
      miniPlanKey: o.mini_plan_key,
      status: o.status,
    })),
    hiddenCount: hiddenOrders.length,
    hiddenByDay,
    horizonDays: horizon,
    dailyTotal,
    dailyTaskCounts,
    condition,
    allocation: {
      Foundation: allocation.Foundation,
      Operations: allocation.Operations,
      Growth: allocation.Growth,
    },
  };
}

async function countTasksForDay(
  blueprintId: string,
  userId: string,
  dayOffset: number,
  hidden: boolean,
): Promise<number> {
  const dayStart = addUtcDays(startOfUtcDay(new Date()), dayOffset);
  const dayEnd = addUtcDays(dayStart, 1);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.user_id, userId),
        hidden ? eq(orders.is_visible, false) : eq(orders.is_visible, true),
        gte(orders.visibility_date, dayStart),
        lt(orders.visibility_date, dayEnd),
      ),
    );
  return count ?? 0;
}

export async function generateScheduledTask(
  params: {
    blueprintId: string;
    userId: string;
    schedule: TaskScheduleOptions;
    generationMode: string;
    generationTrigger: string;
    condition: string;
    enforcementPackageId?: string;
    causationEventId?: string;
  },
): Promise<string | null> {
  const planId = await resolvePlanId(params.blueprintId, params.schedule.miniPlanKey);
  const result = await generate({
    blueprintId: params.blueprintId,
    userId: params.userId,
    generationMode: params.generationMode,
    generationTrigger: params.generationTrigger,
    enforcementPackageId: params.enforcementPackageId,
    causationEventId: params.causationEventId,
    miniPlanKey: params.schedule.miniPlanKey,
    planIdOverride: planId,
    taskSchedule: params.schedule,
    createdFromCondition: params.condition,
  });
  return result.order_ids[0] ?? null;
}

export async function fillBlueprintTaskQueue(input: {
  blueprintId: string;
  userId: string;
  tier?: string | null;
  generationMode?: string;
  generationTrigger?: string;
  enforcementPackageId?: string;
  causationEventId?: string;
  maxGenerations?: number;
}): Promise<{ generated: number; revealed: number }> {
  const t = tierKey(input.tier);
  const horizon = hiddenHorizonDays(t);
  const maxGen = input.maxGenerations ?? MAX_GENERATIONS_PER_RUN;

  const [bp] = await db
    .select({ current_condition: blueprints.current_condition })
    .from(blueprints)
    .where(and(eq(blueprints.id, input.blueprintId), eq(blueprints.user_id, input.userId)))
    .limit(1);

  const condition = bp?.current_condition ?? "stability";
  const allocation = getAllocationForCondition(condition);
  const dailyTotal = dailyTaskTotalForCondition(condition);
  const perMini = distributeDailyTaskCounts(dailyTotal, allocation);

  const revealed = await revealDueTasks(input.blueprintId);
  let generated = 0;
  const mode = generationModeForCondition(condition, input.generationMode ?? "initial");
  const trigger = input.generationTrigger ?? "queue_fill";

  const slots: TaskScheduleOptions[] = [];
  const visibleExisting = await countTasksForDay(input.blueprintId, input.userId, 0, false);
  const visibleNeeded = Math.max(0, dailyTotal - visibleExisting);
  if (visibleNeeded > 0) {
    slots.push(
      ...buildSlotsFromCounts(0, distributeDailyTaskCounts(visibleNeeded, allocation)),
    );
  }

  for (let day = 1; day <= horizon && slots.length < maxGen + visibleNeeded; day++) {
    const existing = await countTasksForDay(input.blueprintId, input.userId, day, true);
    const need = Math.max(0, dailyTotal - existing);
    if (need === 0) continue;
    slots.push(...buildSlotsFromCounts(day, distributeDailyTaskCounts(need, allocation)));
  }

  for (const slot of slots.slice(0, maxGen)) {
    try {
      const id = await generateScheduledTask({
        blueprintId: input.blueprintId,
        userId: input.userId,
        schedule: slot,
        generationMode: mode,
        generationTrigger: trigger,
        condition,
        enforcementPackageId: input.enforcementPackageId,
        causationEventId: input.causationEventId,
      });
      if (id) generated++;
    } catch (err) {
      logger.warn(
        {
          blueprintId: input.blueprintId,
          dayOffset: slot.dayOffset,
          mini: slot.miniPlanKey,
          err: err instanceof Error ? err.message : String(err),
        },
        "[TaskEngine] Single task generation failed",
      );
    }
  }

  await syncTaskGenerationSequence(input.blueprintId, t).catch(() => null);
  return { generated, revealed };
}

export async function mutateHiddenTaskQueue(input: {
  blueprintId: string;
  userId: string;
  tier?: string | null;
  condition: string;
  causationEventId?: string;
}): Promise<{ removed: number; generated: number }> {
  const deleted = await db
    .delete(orders)
    .where(
      and(
        eq(orders.blueprint_id, input.blueprintId),
        eq(orders.user_id, input.userId),
        or(
          eq(orders.is_visible, false),
          inArray(orders.status, [OrderStatus.PRE_GENERATED, OrderStatus.PENDING]),
        ),
      ),
    )
    .returning({ id: orders.id });

  const fill = await fillBlueprintTaskQueue({
    blueprintId: input.blueprintId,
    userId: input.userId,
    tier: input.tier,
    generationMode: "condition_change",
    generationTrigger: "condition_changed",
    causationEventId: input.causationEventId,
    maxGenerations: MAX_GENERATIONS_PER_RUN * 2,
  });

  logger.info(
    { blueprintId: input.blueprintId, removed: deleted.length, generated: fill.generated },
    "[TaskEngine] Hidden queue mutated",
  );

  return { removed: deleted.length, generated: fill.generated };
}

/** After midnight reveal, refill visible + hidden queues for active blueprints. */
export async function topOffTaskQueuesForActiveBlueprints(): Promise<number> {
  const active = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id, tier: blueprints.tier })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

  let filled = 0;
  for (const bp of active) {
    const result = await fillBlueprintTaskQueue({
      blueprintId: bp.id,
      userId: bp.user_id,
      tier: bp.tier,
      generationMode: "daily",
      generationTrigger: "daily_visibility_cycle",
      maxGenerations: MAX_GENERATIONS_PER_RUN,
    }).catch(() => ({ generated: 0, revealed: 0 }));
    filled += result.generated;
  }
  return filled;
}

export async function ensureContinuousVisibleTasks(
  blueprintId: string,
  userId: string,
  goal: string,
): Promise<string | null> {
  const [bp] = await db
    .select({ status: blueprints.status, active: blueprints.active })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!bp || bp.status !== "active" || !bp.active) return null;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.user_id, userId),
        eq(orders.is_visible, true),
        inArray(orders.status, ["pending", "active", "needs_feedback"]),
      ),
    );

  if ((count ?? 0) > 0) return null;

  const [row] = await db
    .insert(orders)
    .values({
      blueprint_id: blueprintId,
      user_id: userId,
      task_type: "execution",
      title: "Check-in: status update",
      instruction: "Check-in: Status update on goal progress",
      expected_output: "Short written reflection on current state and next concrete step",
      definition_of_done: "Written assessment posted with one next action identified",
      why_it_matters: goal.slice(0, 400) || "Ensure continuity and momentum on your blueprint",
      time_estimate_minutes: 30,
      proof_required: false,
      difficulty: "easy",
      priority: 10,
      status: "pending",
      is_visible: true,
      visibility_date: new Date(),
      mini_plan_key: "Operations",
      created_from_condition: "continuity",
      generation_reason: "task_engine_continuity_guarantee",
    })
    .returning({ id: orders.id });

  return row?.id ?? null;
}

export async function revealAllDueTasksGlobal(): Promise<number> {
  return revealDueTasks();
}
