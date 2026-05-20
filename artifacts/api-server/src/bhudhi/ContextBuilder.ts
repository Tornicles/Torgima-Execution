import { db, blueprints, orders, conditions, enforcementPackages } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { BhudhiContextPacket, BhudhiTriggerType } from "../types/bhudhi.js";
import { getContract } from "./PromptRegistry.js";
import { getWorldModel } from "../engines/world-model/WorldModelEngine.js";
import { retrieveMemory } from "./MemoryService.js";
import { stripSecretsFromRecord } from "./contextSanitizer.js";
import { getMaxTokensForTrigger } from "./UsageController.js";

export interface BuildContextParams {
  userId: string;
  blueprintId?: string;
  triggerType: BhudhiTriggerType | string;
  payload?: Record<string, unknown>;
  worldStateVersion: number;
  currentCondition?: string;
  userInput?: string;
}

export async function buildContextPacket(params: BuildContextParams): Promise<BhudhiContextPacket> {
  const packet = await ContextBuilder.build({
    userId: params.userId,
    blueprintId: params.blueprintId,
    triggerType: params.triggerType,
    requestedMode: undefined,
    stateVersion: params.worldStateVersion,
    input: params.userInput,
    facts: params.payload,
    currentCondition: params.currentCondition,
  });

  const contract = getContract(params.triggerType as BhudhiTriggerType);

  let currentOrder: BhudhiContextPacket["currentOrder"];
  if (params.blueprintId) {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.blueprint_id, params.blueprintId), eq(orders.status, "active")))
      .limit(1);
    if (order) {
      currentOrder = {
        id: order.id,
        type: order.task_type ?? "execution",
        difficulty: order.difficulty ?? "moderate",
        proofType: order.proof_type ?? "text",
        status: order.status,
        title: order.title,
      };
    }
  }

  const world = (packet.systemFacts as { worldModel?: unknown }).worldModel;

  return {
    userId: params.userId,
    blueprintId: params.blueprintId,
    triggerType: params.triggerType as BhudhiTriggerType,
    bhudhiMode: contract?.mode ?? "INTERPRET",
    stateVersion: params.worldStateVersion,
    condition: typeof packet.currentCondition === "string" ? packet.currentCondition : undefined,
    allowedActions: (packet.allowedActions as string[]) ?? [],
    forbiddenActions: (packet.forbiddenActions as string[]) ?? [],
    currentOrder,
    userInput: params.userInput,
    systemFacts: stripSecretsFromRecord({
      ...(params.payload ?? {}),
      worldModel: world,
    }),
    memoryContext: typeof packet.memorySummary === "string" ? packet.memorySummary : undefined,
    outputContractName: contract?.name ?? "unknown",
    maxTokens: getMaxTokensForTrigger(params.triggerType),
  };
}

export interface ContextBuildRequest {
  userId: string;
  blueprintId?: string;
  triggerType: BhudhiTriggerType | string;
  requestedMode?: string;
  stateVersion: number;
  input?: string;
  facts?: Record<string, unknown>;
  currentCondition?: string;
}

/** B3 context assembly — summaries only, secrets stripped. */
export const ContextBuilder = {
  async build(request: ContextBuildRequest): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = stripSecretsFromRecord({
      userId: request.userId,
      blueprintId: request.blueprintId,
      triggerType: request.triggerType,
      mode: request.requestedMode,
      stateVersion: request.stateVersion,
      userInput: request.input,
    });

    let blueprintRow: typeof blueprints.$inferSelect | undefined;
    if (request.blueprintId) {
      const [bp] = await db
        .select()
        .from(blueprints)
        .where(eq(blueprints.id, request.blueprintId))
        .limit(1);
      blueprintRow = bp;

      const [cond] = await db
        .select({ condition: conditions.condition })
        .from(conditions)
        .where(
          and(eq(conditions.blueprint_id, request.blueprintId), eq(conditions.is_current, true)),
        )
        .limit(1);
      ctx.currentCondition =
        request.currentCondition ?? cond?.condition ?? bp?.current_condition ?? null;

      const [enf] = await db
        .select({
          allowedActions: enforcementPackages.allowed_actions,
          forbiddenActions: enforcementPackages.blocked_actions,
        })
        .from(enforcementPackages)
        .where(
          and(
            eq(enforcementPackages.blueprint_id, request.blueprintId),
            eq(enforcementPackages.is_current, true),
          ),
        )
        .limit(1);
      ctx.allowedActions = enf?.allowedActions ?? [];
      ctx.forbiddenActions = enf?.forbiddenActions ?? [];
    }

    const contract = getContract(request.triggerType as BhudhiTriggerType);
    const memorySummary = contract?.memoryAllowed
      ? await retrieveMemory({
          userId: request.userId,
          blueprintId: request.blueprintId,
          triggerType: request.triggerType as BhudhiTriggerType,
        }).catch(() => "")
      : "";
    ctx.memorySummary = memorySummary || null;

    const world = await getWorldModel(request.userId).catch(() => null);
    ctx.systemFacts = stripSecretsFromRecord({
      ...(request.facts ?? {}),
      worldModel: world,
      blueprintGoal: blueprintRow?.goal,
      blueprintPurpose: blueprintRow?.purpose,
      blueprintStateVersion: blueprintRow?.state_version ?? request.stateVersion,
    });

    return ctx;
  },

  retrieveRelevantMemory: retrieveMemory,
};
