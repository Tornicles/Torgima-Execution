import {
  db,
  orders,
  conditions,
  capabilityProfiles,
  enforcementPackages,
  behaviorPatterns,
} from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

const DIFFICULTY_ORDER = ["very_easy", "easy", "moderate", "hard", "very_hard"] as const;

export interface ScoredOrder {
  orderId:    string;
  totalScore: number;
  breakdown:  {
    outcomeImpact:      number;
    urgency:            number;
    dependencyLeverage: number;
    executability:      number;
    conditionFit:       number;
    capabilityFit:      number;
    frictionRisk:       number;
  };
}

function capabilityToDifficultyIndex(level: string | null | undefined): number {
  switch (level) {
    case "operator":
      return DIFFICULTY_ORDER.indexOf("moderate");
    case "advanced":
      return DIFFICULTY_ORDER.indexOf("hard");
    case "lead":
      return DIFFICULTY_ORDER.indexOf("very_hard");
    case "beginner":
    default:
      return DIFFICULTY_ORDER.indexOf("easy");
  }
}

export async function scoreAndRankOrders(params: {
  blueprintId: string;
  userId:      string;
  orderIds?:   string[];
}): Promise<ScoredOrder[]> {
  const baseWhere = params.orderIds?.length
    ? and(
        eq(orders.blueprint_id, params.blueprintId),
        eq(orders.user_id, params.userId),
        inArray(orders.id, params.orderIds),
      )
    : and(
        eq(orders.blueprint_id, params.blueprintId),
        eq(orders.user_id, params.userId),
        inArray(orders.status, ["pending", "active"]),
      );

  const orderRows = await db
    .select()
    .from(orders)
    .where(baseWhere)
    .orderBy(asc(orders.created_at))
    .limit(20);

  const [condition] = await db
    .select()
    .from(conditions)
    .where(
      and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)),
    )
    .limit(1);

  const [capability] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  const [enforcement] = await db
    .select()
    .from(enforcementPackages)
    .where(
      and(
        eq(enforcementPackages.blueprint_id, params.blueprintId),
        eq(enforcementPackages.is_current, true),
      ),
    )
    .limit(1);

  const patterns = await db
    .select()
    .from(behaviorPatterns)
    .where(
      and(
        eq(behaviorPatterns.user_id, params.userId),
        eq(behaviorPatterns.blueprint_id, params.blueprintId),
        eq(behaviorPatterns.status, "active"),
      ),
    );

  const conditionName = condition?.condition ?? "urgency";
  const capLevel = capability?.level ?? "beginner";
  void enforcement;
  const hasAbandonRisk = patterns.some(
    p =>
      p.pattern_type === "inactivity" &&
      (p.evidence_json as { spec_label?: string })?.spec_label === "ABANDONMENT_RISK",
  );

  const capIdx = capabilityToDifficultyIndex(capLevel);

  const scored: ScoredOrder[] = orderRows.map(order => {
    const outcomeImpact =
      order.task_type === "phase_checkpoint"
        ? 2.0
        : order.task_type === "execution"
          ? 1.5
          : order.task_type === "recovery"
            ? 0.5
            : 1.0;

    const urgency =
      order.task_type === "recovery" && ["danger", "nothingness"].includes(conditionName)
        ? 2.0
        : conditionName === "power" || conditionName === "affluence"
          ? 0.5
          : 1.0;

    const dependencyLeverage = order.task_type === "blocker_resolution" ? 2.0 : 0.5;

    const diffIdxRaw = DIFFICULTY_ORDER.indexOf(
      (order.difficulty ?? "moderate") as (typeof DIFFICULTY_ORDER)[number],
    );
    const diffIdx = diffIdxRaw >= 0 ? diffIdxRaw : DIFFICULTY_ORDER.indexOf("moderate");

    const executability =
      diffIdx <= capIdx ? 2.0 : diffIdx <= capIdx + 1 ? 1.0 : 0.3;

    const conditionFit =
      order.task_type === "recovery" &&
      ["danger", "nothingness", "urgency"].includes(conditionName)
        ? 2.0
        : order.task_type === "execution" &&
            ["power", "affluence", "stability"].includes(conditionName)
          ? 2.0
          : 1.0;

    const capabilityFit =
      diffIdx <= capIdx ? 2.0 : diffIdx === capIdx + 1 ? 1.2 : 0.5;

    const frictionRisk = hasAbandonRisk && diffIdx >= 3 ? -1.0 : 0;

    const totalScore =
      outcomeImpact +
      urgency +
      dependencyLeverage +
      executability +
      conditionFit +
      capabilityFit +
      frictionRisk;

    return {
      orderId: order.id,
      totalScore,
      breakdown: {
        outcomeImpact,
        urgency,
        dependencyLeverage,
        executability,
        conditionFit,
        capabilityFit,
        frictionRisk,
      },
    };
  });

  scored.sort(
    (a, b) => b.totalScore - a.totalScore || a.orderId.localeCompare(b.orderId),
  );

  for (const s of scored) {
    try {
      await db
        .update(orders)
        .set({ priority: Math.round(s.totalScore * 10) })
        .where(eq(orders.id, s.orderId));
    } catch (err) {
      logger.debug({ err, orderId: s.orderId }, "[PriorityEngine] priority update skipped");
    }
  }

  return scored;
}
