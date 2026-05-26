import { db, blueprints, orders } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { CognitiveKernel, cognitiveKernel } from "../kernel/cognitive-kernel/CognitiveKernel.js";
import { sharedContextService } from "../kernel/shared-context/SharedContext.js";
import { intelligenceService } from "../intelligence/IntelligenceService.js";
import { signalService } from "../signals/SignalService.js";
import { torgimaIntegration } from "../integration/TorgimaIntegration.js";
import { torgimaBhudhiBridge, TorgimaBhudhiBridge } from "./TorgimaBhudhiBridge.js";
import { logger } from "../../lib/logger.js";
import type {
  ConvergenceExecuteResult,
  ConvergenceFeedbackResult,
  ConvergenceUnifiedState,
  ProposedNextOrder,
  TorgimaBlueprintSnapshot,
} from "./types.js";

function blueprintSnapshot(row: {
  id: string;
  goal: string;
  purpose: string | null;
  domain: string | null;
  current_domain: string | null;
  current_project_id: string | null;
  current_action_id: string | null;
  current_condition: string | null;
  user_id: string;
}): TorgimaBlueprintSnapshot {
  return {
    id: row.id,
    goal: row.goal,
    purpose: row.purpose,
    domain: row.domain,
    currentDomain: row.current_domain,
    currentProjectId: row.current_project_id,
    currentActionId: row.current_action_id,
    currentCondition: row.current_condition,
    userId: row.user_id,
  };
}

function buildProposedOrder(
  strategy: Record<string, unknown>,
  topRec: { title: string; description: string; reasoning: string; confidence: number } | null,
): ProposedNextOrder {
  const selected =
    (strategy.selected as string | undefined) ??
    (strategy.primary as string | undefined) ??
    topRec?.title;

  if (!selected && !topRec) {
    return {
      instruction: "Clarify goal and gather more information",
      title: "Clarify next steps",
      expectedOutput: "Clear understanding of the next concrete action",
      definitionOfDone: "Goals are articulated and the next order is unambiguous",
      whyItMatters: "Prevents wasted effort on unclear objectives",
      proofRequired: false,
      reasoning: null,
      confidence: null,
      source: "fallback",
    };
  }

  const title = topRec?.title ?? String(selected);
  const description = topRec?.description ?? `Complete: ${selected}`;

  return {
    instruction: title,
    title,
    expectedOutput: description,
    definitionOfDone: "Order completed and verified through Torgima feedback",
    whyItMatters: topRec?.reasoning ?? (strategy.reasoning as string) ?? "Progresses toward goal completion",
    proofRequired: true,
    reasoning: topRec?.reasoning ?? null,
    confidence: topRec?.confidence ?? null,
    source: topRec ? "recommendation" : "strategy",
  };
}

export class ConvergenceLayer {
  constructor(
    private kernel: CognitiveKernel = cognitiveKernel,
    private bridge: TorgimaBhudhiBridge = torgimaBhudhiBridge,
  ) {}

  async getUnifiedState(blueprintId: string): Promise<ConvergenceUnifiedState | null> {
    const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
    if (!bp) return null;

    const [activeOrder] = await db
      .select({
        id: orders.id,
        title: orders.title,
        instruction: orders.instruction,
        expected_output: orders.expected_output,
        status: orders.status,
      })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          inArray(orders.status, ["pending", "active"]),
        ),
      )
      .orderBy(desc(orders.updated_at))
      .limit(1);

    let ctx;
    try {
      ctx = await sharedContextService.getContext(blueprintId);
    } catch {
      ctx = null;
    }

    const recommendations = await intelligenceService.listRecommendations(blueprintId).catch(() => []);
    const top = recommendations.sort((a, b) => b.confidence - a.confidence)[0];

    const signal = ctx?.signal ?? "stability";
    const control = this.bridge.mapSignalToControl(signal);

    return {
      blueprint: blueprintSnapshot(bp),
      currentOrder: activeOrder
        ? {
            id: activeOrder.id,
            title: activeOrder.title,
            instruction: activeOrder.instruction,
            expectedOutput: activeOrder.expected_output,
            status: activeOrder.status,
          }
        : null,
      bhudhi: {
        signal,
        condition: ctx?.condition ?? signal,
        control,
        recommendation: top ? `${top.title}: ${top.description}` : null,
        confidence: top?.confidence ?? null,
        chainId: null,
        cycleStatus: null,
      },
    };
  }

  async executeGoal(
    blueprintId: string,
    options?: { createOrder?: boolean; syncRecommendations?: boolean },
  ): Promise<ConvergenceExecuteResult> {
    const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
    if (!bp) {
      throw new Error(`Blueprint not found: ${blueprintId}`);
    }

    const intelligence = await this.kernel.runCycle(blueprintId);
    const signals = await signalService.calculateSignals(blueprintId);
    const signal = signals.globalSignal ?? intelligence.context.signal;
    const control = this.bridge.mapSignalToControl(signal);

    await this.updateTorgimaState(blueprintId, signal, control);

    const recommendations = await intelligenceService.listRecommendations(blueprintId);
    const top = [...recommendations].sort((a, b) => b.confidence - a.confidence)[0] ?? null;

    if (options?.syncRecommendations && recommendations.length > 0) {
      await this.bridge.syncRecommendationsAsOrders(
        blueprintId,
        bp.user_id,
        recommendations.slice(0, 3).map((r) => ({
          title: r.title,
          description: r.description,
          reasoning: r.reasoning,
          confidence: r.confidence,
        })),
      );
    }

    const proposedOrder = buildProposedOrder(intelligence.context.strategy, top);

    let orderId: string | null = null;
    if (options?.createOrder) {
      const [order] = await db
        .insert(orders)
        .values({
          blueprint_id: blueprintId,
          user_id: bp.user_id,
          task_type: "execution",
          title: proposedOrder.title.slice(0, 200),
          instruction: proposedOrder.instruction,
          expected_output: proposedOrder.expectedOutput,
          definition_of_done: proposedOrder.definitionOfDone,
          why_it_matters: proposedOrder.whyItMatters,
          proof_required: proposedOrder.proofRequired,
          difficulty: "moderate",
          priority: 5,
          status: "pending",
          generation_reason: "convergence_layer",
          domain: bp.current_domain ?? "delivery",
          condition_at_generation: this.bridge.mapSignalToCondition(signal),
        })
        .returning({ id: orders.id });
      orderId = order?.id ?? null;
    }

    logger.info(
      { blueprintId, signal, control, cycleStatus: intelligence.status, orderId },
      "[ConvergenceLayer] executeGoal complete",
    );

    return {
      blueprint: blueprintSnapshot(bp),
      intelligence,
      signal,
      control,
      proposedOrder,
      orderId,
      recommendation: top
        ? {
            id: top.id,
            title: top.title,
            description: top.description,
            confidence: top.confidence,
          }
        : null,
    };
  }

  async processFeedback(
    blueprintId: string,
    orderId: string,
    feedback: Record<string, unknown>,
  ): Promise<ConvergenceFeedbackResult> {
    await sharedContextService.updateSubsystem(
      blueprintId,
      "execution",
      {
        lastFeedback: { orderId, ...feedback, at: new Date().toISOString() },
      },
      "convergence",
    );

    const bhudhi = await torgimaIntegration.processTaskFeedback(blueprintId, orderId, feedback);
    const convergence = await this.executeGoal(blueprintId, { createOrder: false });

    return {
      feedbackProcessed: true,
      bhudhi,
      convergence,
    };
  }

  private async updateTorgimaState(blueprintId: string, signal: string, control: string) {
    const condition = this.bridge.mapSignalToCondition(signal);

    const [existing] = await db
      .select({ metadata: blueprints.metadata })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);

    const prior =
      existing?.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};

    await db
      .update(blueprints)
      .set({
        current_condition: condition,
        metadata: {
          ...prior,
          convergence: {
            signal,
            control,
            updatedAt: new Date().toISOString(),
          },
        },
        updated_at: new Date(),
      })
      .where(eq(blueprints.id, blueprintId));

    await sharedContextService.updateContext(
      blueprintId,
      { signal, condition },
      "convergence",
    );
  }
}

export const convergenceLayer = new ConvergenceLayer();
