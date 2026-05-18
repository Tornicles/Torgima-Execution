import { db, blueprints, orders, conditions } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { BhudhiContextPacket, BhudhiTriggerType } from "../types/bhudhi.js";
import { getContract } from "./PromptRegistry.js";
import { getWorldModel } from "../engines/world-model/WorldModelEngine.js";
import { retrieveMemory } from "./MemoryService.js";

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
  const contract = getContract(params.triggerType as BhudhiTriggerType);
  const world = await getWorldModel(params.userId);

  let condition = params.currentCondition;
  let blueprintRow: typeof blueprints.$inferSelect | undefined;
  if (params.blueprintId) {
    const [bp] = await db
      .select()
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);
    blueprintRow = bp;
    if (!condition && bp?.current_condition) {
      condition = bp.current_condition;
    }
    if (!condition) {
      const [cond] = await db
        .select({ condition: conditions.condition })
        .from(conditions)
        .where(and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)))
        .limit(1);
      condition = cond?.condition ?? "stability";
    }
  }

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

  const memoryContext = contract?.memoryAllowed
    ? await retrieveMemory({
        userId: params.userId,
        blueprintId: params.blueprintId,
        triggerType: params.triggerType as BhudhiTriggerType,
      }).catch(() => "")
    : "";

  const systemFacts: Record<string, unknown> = {
    ...params.payload,
    worldModel: world,
    blueprintGoal: blueprintRow?.goal,
    blueprintPurpose: blueprintRow?.purpose,
    blueprintStateVersion: blueprintRow?.state_version ?? params.worldStateVersion,
  };

  return {
    userId: params.userId,
    blueprintId: params.blueprintId,
    triggerType: params.triggerType as BhudhiTriggerType,
    bhudhiMode: contract?.mode ?? "INTERPRET",
    stateVersion: params.worldStateVersion,
    condition,
    allowedActions: ["interpret", "draft", "explain", "suggest"],
    forbiddenActions: [
      "override_signal",
      "set_condition",
      "approve_blueprint",
      "complete_phase",
      "grant_permission",
      "write_signal_value",
      "bypass_control_engine",
    ],
    currentOrder,
    userInput: params.userInput,
    systemFacts,
    memoryContext: memoryContext || undefined,
    outputContractName: contract?.name ?? "unknown",
    maxTokens: contract?.maxTokens ?? 1024,
  };
}
