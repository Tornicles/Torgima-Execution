/**
 * MINI_PLAN_ALLOCATION_SPECIFICATION.md — Foundation / Operations / Growth allocation by condition.
 */
import { blueprints, db, miniPlanAllocationHistory, miniPlanSequences, orders, plans } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import type { Condition } from "../../constants/conditions.js";
import { dailyTasksForCondition } from "../../constants/conditionSpec.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { syncTaskGenerationSequence } from "../sequence/sequenceTaskQueueService.js";
import { mutateHiddenTaskQueue } from "../task-engine/TaskEngine.js";
import { logger } from "../../lib/logger.js";

export const MINI_PLAN_KEYS = ["Foundation", "Operations", "Growth"] as const;
export type MiniPlanKey = (typeof MINI_PLAN_KEYS)[number];

export type MiniPlanAllocation = Record<MiniPlanKey, number>;

/** LOCKED condition → % split (sums to 100). */
export const ALLOCATION_BY_CONDITION: Record<string, MiniPlanAllocation> = {
  danger: { Foundation: 60, Operations: 30, Growth: 10 },
  urgency: { Foundation: 30, Operations: 40, Growth: 30 },
  stability: { Foundation: 30, Operations: 30, Growth: 40 },
  power: { Foundation: 20, Operations: 30, Growth: 50 },
  nothingness: { Foundation: 55, Operations: 35, Growth: 10 },
  affluence: { Foundation: 15, Operations: 25, Growth: 60 },
  power_change: { Foundation: 25, Operations: 35, Growth: 40 },
};

export const DEFAULT_STARTER_ALLOCATION = ALLOCATION_BY_CONDITION.stability;

/** Spec PART 7 — dashboard copy per condition. */
export const ALLOCATION_DASHBOARD_BY_CONDITION: Record<
  string,
  { tagline: string; foundationSub: string; operationsSub: string; growthSub: string }
> = {
  danger: {
    tagline: "Recovery focus — strengthen foundation before expanding.",
    foundationSub: "Blockers, clarifications, simplifications",
    operationsSub: "Essential delivery only",
    growthSub: "Paused — optional reflection",
  },
  urgency: {
    tagline: "Stabilization focus — more Operations work coming.",
    foundationSub: "Steady infrastructure",
    operationsSub: "Stabilize execution and resolve blockers",
    growthSub: "Maintain learning pace",
  },
  stability: {
    tagline: "Balanced execution — normal learning emphasis.",
    foundationSub: "Build core capability",
    operationsSub: "Execute daily work",
    growthSub: "Learn and improve",
  },
  power: {
    tagline: "Acceleration — you're exceeding expectations.",
    foundationSub: "Maintain core (minimal)",
    operationsSub: "Steady delivery",
    growthSub: "Maximize learning and expansion",
  },
  nothingness: {
    tagline: "Bootstrapping — minimum mix until signals stabilize.",
    foundationSub: "Core setup",
    operationsSub: "Minimum execution",
    growthSub: "Light exploration",
  },
  affluence: {
    tagline: "Peak execution — strategic growth emphasis.",
    foundationSub: "Light maintenance",
    operationsSub: "Scale delivery",
    growthSub: "Strategic expansion",
  },
  power_change: {
    tagline: "Condition in flux — moderated balanced mix.",
    foundationSub: "Stabilize core",
    operationsSub: "Controlled execution",
    growthSub: "Measured learning",
  },
};

/** Spec PART 6 — generation focus hints by condition × mini plan. */
const MINI_PLAN_FOCUS: Record<string, Record<MiniPlanKey, string>> = {
  danger: {
    Foundation: "Resolve blockers, simplify approach, and clarify the next concrete step.",
    Operations: "Preserve essential delivery only — no new scope.",
    Growth: "Optional single reflection task; pause exploration.",
  },
  urgency: {
    Foundation: "Keep foundation steady while operations recover.",
    Operations: "Prioritize blocker resolution, quality fixes, and process stabilization.",
    Growth: "Continue light learning without adding scope.",
  },
  stability: {
    Foundation: "Build and maintain core infrastructure.",
    Operations: "Execute the plan with consistent daily delivery.",
    Growth: "Research, learn, and explore improvement opportunities.",
  },
  power: {
    Foundation: "Optional maintenance — core is already solid.",
    Operations: "Sustain high-quality delivery at current pace.",
    Growth: "Accelerate learning, partnerships, and expansion experiments.",
  },
};

const PLAN_NAME_TO_MINI: Record<string, MiniPlanKey> = {
  Foundation: "Foundation",
  Operations: "Operations",
  Validation: "Operations",
  Growth: "Growth",
  Scale: "Growth",
};

export function normalizeConditionKey(condition: string): string {
  return condition.toLowerCase().replace(/\s+/g, "_");
}

export function getAllocationForCondition(condition: string): MiniPlanAllocation {
  const key = normalizeConditionKey(condition);
  return { ...(ALLOCATION_BY_CONDITION[key] ?? DEFAULT_STARTER_ALLOCATION) };
}

export function mapPlanNameToMiniPlan(planName: string): MiniPlanKey {
  return PLAN_NAME_TO_MINI[planName] ?? "Operations";
}

/** Distribute `total` daily tasks across mini plans using largest-remainder method. */
export function distributeDailyTaskCounts(
  total: number,
  allocation: MiniPlanAllocation,
): Record<MiniPlanKey, number> {
  const keys = MINI_PLAN_KEYS;
  const raw = keys.map((k) => ({ k, exact: (total * allocation[k]) / 100 }));
  const buckets = raw.map((r) => ({
    k: r.k,
    count: Math.floor(r.exact),
    frac: r.exact - Math.floor(r.exact),
  }));
  let remaining = total - buckets.reduce((s, b) => s + b.count, 0);
  const sorted = [...buckets].sort((a, b) => b.frac - a.frac);
  for (let i = 0; remaining > 0; i++, remaining--) {
    sorted[i % sorted.length]!.count += 1;
  }
  return Object.fromEntries(buckets.map((b) => [b.k, b.count])) as Record<MiniPlanKey, number>;
}

export function allocationUserMessage(
  previousCondition: string | null,
  newCondition: string,
): string {
  const alloc = getAllocationForCondition(newCondition);
  const prev = previousCondition ? normalizeConditionKey(previousCondition) : null;
  const next = normalizeConditionKey(newCondition);

  if (next === "urgency") {
    return `Your condition changed to URGENCY. Adjusting work mix to support you. More Operations focus (${alloc.Operations}% of daily work).`;
  }
  if (next === "danger") {
    return `Your condition changed to DANGER. Prioritizing Foundation recovery (${alloc.Foundation}% of daily work).`;
  }
  if (next === "power") {
    return `You're exceeding expectations — POWER mode. More Growth focus (${alloc.Growth}% of daily work).`;
  }
  if (next === "stability" && prev && prev !== next) {
    return `Condition returned to STABILITY. Balanced mix (F:${alloc.Foundation}% O:${alloc.Operations}% G:${alloc.Growth}%).`;
  }
  if (prev && prev !== next) {
    return `Condition updated to ${newCondition.toUpperCase()}. Work mix adapts automatically (F:${alloc.Foundation}% O:${alloc.Operations}% G:${alloc.Growth}%).`;
  }
  return `Current allocation: Foundation ${alloc.Foundation}%, Operations ${alloc.Operations}%, Growth ${alloc.Growth}%.`;
}

export function buildQueueDayPattern(counts: Record<MiniPlanKey, number>): string[] {
  return [
    ...Array(counts.Foundation).fill("F"),
    ...Array(counts.Operations).fill("O"),
    ...Array(counts.Growth).fill("G"),
  ];
}

export function getAllocationDashboardSpec(condition: string) {
  const key = normalizeConditionKey(condition);
  return ALLOCATION_DASHBOARD_BY_CONDITION[key] ?? ALLOCATION_DASHBOARD_BY_CONDITION.stability;
}

export function getMiniPlanTaskFocus(condition: string, miniPlanKey: MiniPlanKey): string {
  const key = normalizeConditionKey(condition);
  const row = MINI_PLAN_FOCUS[key] ?? MINI_PLAN_FOCUS.stability;
  return row?.[miniPlanKey] ?? MINI_PLAN_FOCUS.stability![miniPlanKey];
}

export async function readCurrentAllocation(
  blueprintId: string,
): Promise<{ condition: string; allocation: MiniPlanAllocation; perPlan: Record<string, number> }> {
  const [bp] = await db
    .select({ current_condition: blueprints.current_condition })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  const condition = bp?.current_condition ?? "stability";
  const allocation = getAllocationForCondition(condition);

  const planRows = await db
    .select({ name: plans.name })
    .from(plans)
    .where(eq(plans.blueprint_id, blueprintId));

  const perPlan: Record<string, number> = {};
  for (const p of planRows) {
    const mini = mapPlanNameToMiniPlan(p.name);
    perPlan[p.name] = allocation[mini];
  }

  return {
    condition,
    allocation,
    perPlan,
  };
}

async function buildCrossPlanPrep(
  blueprintId: string,
  allocation: MiniPlanAllocation,
): Promise<Record<string, number>> {
  const planRows = await db.select({ name: plans.name }).from(plans).where(eq(plans.blueprint_id, blueprintId));
  const out: Record<string, number> = { ...allocation };
  for (const p of planRows) {
    const mini = mapPlanNameToMiniPlan(p.name);
    out[p.name] = allocation[mini];
  }
  return out;
}

export async function deleteHiddenFutureOrders(blueprintId: string, userId: string): Promise<number> {
  const deleted = await db
    .delete(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.user_id, userId),
        eq(orders.is_visible, false),
        inArray(orders.status, ["pre_generated", "pending"]),
      ),
    )
    .returning({ id: orders.id });
  return deleted.length;
}

export async function applyMiniPlanAllocation(input: {
  blueprintId: string;
  userId: string;
  condition: string;
  previousCondition?: string | null;
  reason?: string;
  regenerateQueue?: boolean;
  tier?: string | null;
}): Promise<{
  allocation: MiniPlanAllocation;
  crossPlanPrep: Record<string, number>;
  dailyTaskCounts: Record<MiniPlanKey, number>;
  message: string;
}> {
  const allocation = getAllocationForCondition(input.condition);
  const crossPlanPrep = await buildCrossPlanPrep(input.blueprintId, allocation);
  const dailyTotal = dailyTasksForCondition(input.condition);
  const dailyTaskCounts = distributeDailyTaskCounts(dailyTotal, allocation);

  await db
    .insert(miniPlanSequences)
    .values({
      blueprint_id: input.blueprintId,
      mini_plans: [...MINI_PLAN_KEYS],
      cross_plan_prep: crossPlanPrep,
    })
    .onConflictDoUpdate({
      target: miniPlanSequences.blueprint_id,
      set: { cross_plan_prep: crossPlanPrep, mini_plans: [...MINI_PLAN_KEYS] },
    });

  await db.insert(miniPlanAllocationHistory).values({
    blueprint_id: input.blueprintId,
    user_id: input.userId,
    condition: normalizeConditionKey(input.condition),
    allocation,
    daily_task_counts: dailyTaskCounts,
    previous_condition: input.previousCondition
      ? normalizeConditionKey(input.previousCondition)
      : null,
    reason: input.reason ?? "condition_allocation",
    tasks_affected: 0,
  });

  const message = allocationUserMessage(input.previousCondition ?? null, input.condition);

  logger.info(
    {
      blueprintId: input.blueprintId,
      condition: input.condition,
      allocation,
      dailyTaskCounts,
    },
    "[MiniPlanAllocation] Applied",
  );

  return { allocation, crossPlanPrep, dailyTaskCounts, message };
}

export async function onConditionChanged(input: {
  blueprintId: string;
  userId: string;
  newCondition: string;
  previousCondition: string;
  causationEventId?: string;
  tier?: string | null;
}): Promise<{ allocationAdjusted: boolean; message: string }> {
  const result = await applyMiniPlanAllocation({
    blueprintId: input.blueprintId,
    userId: input.userId,
    condition: input.newCondition,
    previousCondition: input.previousCondition,
    reason: `Condition ${input.previousCondition} → ${input.newCondition}`,
    tier: input.tier,
    regenerateQueue: false,
  });

  const mutation = await mutateHiddenTaskQueue({
    blueprintId: input.blueprintId,
    userId: input.userId,
    tier: input.tier,
    condition: input.newCondition,
    causationEventId: input.causationEventId,
  }).catch(() => ({ removed: 0, generated: 0 }));

  await db
    .update(miniPlanAllocationHistory)
    .set({ tasks_affected: mutation.removed })
    .where(
      and(
        eq(miniPlanAllocationHistory.blueprint_id, input.blueprintId),
        eq(miniPlanAllocationHistory.condition, normalizeConditionKey(input.newCondition)),
      ),
    )
    .catch(() => null);

  await writeEvent({
    eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
    entityType: "blueprint",
    entityId: input.blueprintId,
    userId: input.userId,
    blueprintId: input.blueprintId,
    payload: {
      generation_mode: "condition_change",
      generation_trigger: "condition_changed",
      allocation: result.allocation,
      daily_task_counts: result.dailyTaskCounts,
      message: result.message,
    },
    idempotencyKey: `mini_plan_alloc:${input.blueprintId}:${normalizeConditionKey(input.newCondition)}`,
    causationEventId: input.causationEventId,
  });

  await syncTaskGenerationSequence(input.blueprintId, input.tier).catch(() => null);

  return { allocationAdjusted: true, message: result.message };
}

export async function initializeStarterAllocation(blueprintId: string, userId: string) {
  return applyMiniPlanAllocation({
    blueprintId,
    userId,
    condition: "stability",
    reason: "blueprint_created",
    regenerateQueue: false,
  });
}
