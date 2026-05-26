import { db, blueprints, orders } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { ALL_CONDITIONS, type Condition } from "../../constants/conditions.js";
import type { ConvergenceBlueprintContext } from "./types.js";

const SIGNAL_TO_CONTROL: Record<string, string> = {
  nothingness: "clarify",
  danger: "recover",
  urgency: "accelerate",
  stability: "maintain",
  power: "scale",
  affluence: "optimize",
  power_change: "transition",
};

const DOMAIN_TO_BHUDHI: Record<string, string> = {
  genesis: "genesis",
  market: "market",
  delivery: "delivery",
  continuity: "continuity",
  growth: "omnigrowth",
  strategy: "strategycore",
  customer: "customervalue",
  finance: "finmatrix",
  operations: "synergyops",
  people: "talentsync",
  culture: "culturedynamics",
};

const PHASE_TO_BHUDHI: Record<string, string> = {
  planning: "exploration",
  initiation: "initiation",
  execution: "execution",
  optimization: "optimization",
  closure: "scaling",
};

export class TorgimaBhudhiBridge {
  async mapBlueprint(blueprintId: string): Promise<ConvergenceBlueprintContext | null> {
    const [row] = await db
      .select({
        id: blueprints.id,
        goal: blueprints.goal,
        purpose: blueprints.purpose,
        timeframe_days: blueprints.timeframe_days,
        domain: blueprints.domain,
        current_domain: blueprints.current_domain,
        current_project_id: blueprints.current_project_id,
        current_action_id: blueprints.current_action_id,
      })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);

    if (!row) return null;

    return {
      blueprintId: row.id,
      goal: row.goal,
      purpose: row.purpose,
      timeframeDays: row.timeframe_days,
      domain: this.mapDomain(row.domain ?? row.current_domain ?? undefined),
      phase: this.mapPhase(undefined),
      targetId: null,
      projectId: row.current_project_id,
      actionId: row.current_action_id,
    };
  }

  mapSignalToControl(signal: string): string {
    return SIGNAL_TO_CONTROL[signal] ?? "maintain";
  }

  mapSignalToCondition(signal: string): Condition {
    const normalized = signal.toLowerCase();
    if ((ALL_CONDITIONS as readonly string[]).includes(normalized)) {
      return normalized as Condition;
    }
    return "stability";
  }

  mapDomain(domain?: string | null): string {
    if (!domain) return "strategycore";
    return DOMAIN_TO_BHUDHI[domain] ?? domain;
  }

  mapPhase(phase?: string): string {
    if (!phase) return "execution";
    return PHASE_TO_BHUDHI[phase] ?? phase;
  }

  async syncOrders(blueprintId: string) {
    const rows = await db
      .select({
        id: orders.id,
        instruction: orders.instruction,
        expectedOutput: orders.expected_output,
        definitionOfDone: orders.definition_of_done,
        proofRequired: orders.proof_required,
        status: orders.status,
        title: orders.title,
      })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          inArray(orders.status, ["pending", "active"]),
        ),
      );

    return rows.map((o) => ({
      id: o.id,
      title: o.title,
      instruction: o.instruction,
      expectedOutput: o.expectedOutput,
      definitionOfDone: o.definitionOfDone,
      proofRequired: o.proofRequired,
      status: o.status,
    }));
  }

  async syncRecommendationsAsOrders(
    blueprintId: string,
    userId: string,
    recommendations: Array<{
      title: string;
      description: string;
      reasoning: string;
      confidence: number;
    }>,
  ): Promise<string[]> {
    const created: string[] = [];

    for (const rec of recommendations) {
      const [existing] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(eq(orders.blueprint_id, blueprintId), eq(orders.title, rec.title)),
        )
        .limit(1);

      if (existing) continue;

      const [order] = await db
        .insert(orders)
        .values({
          blueprint_id: blueprintId,
          user_id: userId,
          task_type: "execution",
          title: rec.title.slice(0, 200),
          instruction: rec.description,
          expected_output: rec.description,
          definition_of_done: "Recommendation implemented and verified in feedback",
          why_it_matters: rec.reasoning,
          proof_required: true,
          difficulty: "moderate",
          priority: 5,
          status: "pending",
          generation_reason: "convergence_recommendation",
          domain: "delivery",
        })
        .returning({ id: orders.id });

      if (order?.id) created.push(order.id);
    }

    return created;
  }
}

export const torgimaBhudhiBridge = new TorgimaBhudhiBridge();
