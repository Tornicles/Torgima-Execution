import { invokeBhudhiModel, runBhudhiPipeline } from "../../bhudhi/BhudhiCore.js";
import type { BhudhiOutputEnvelope, BhudhiTriggerResult } from "../../types/bhudhi.js";
import { BhudhiLogWriter } from "./BhudhiLogWriter.js";
import { BhudhiRejected } from "./BhudhiRejected.js";
import { BudgetController } from "./BudgetController.js";
import { ContextBuilder } from "./ContextBuilder.js";
import { FallbackLibrary } from "./FallbackLibrary.js";
import { OutputValidator } from "./OutputValidator.js";
import { getPromptContract } from "./prompts/PromptContracts.js";
import { checkFeatureFlag } from "../utils.js";
import {
  REGISTERED_TRIGGERS,
  type Doc12TriggerType,
  isDoc12Trigger,
  isSourceAllowedForTrigger,
} from "./TriggerRegistry.js";

export interface Doc12BhudhiTriggerRequest {
  triggerType: Doc12TriggerType | string;
  sourceEngine: string;
  userId: string;
  blueprintId?: string;
  stateVersion: number;
  input?: Record<string, unknown>;
  facts?: Record<string, unknown>;
  idempotencyKey: string;
  requestedMode?: string;
  userInput?: string;
}

export interface BhudhiValidatedOutput {
  ok: boolean;
  data?: BhudhiOutputEnvelope;
  logId: string;
  fallbackUsed: boolean;
  failureReason?: string;
}

function toPipelineResult(result: BhudhiTriggerResult): BhudhiValidatedOutput {
  return {
    ok: result.ok,
    data: result.output,
    logId: result.logId,
    fallbackUsed: result.fallbackUsed,
    failureReason: result.failureReason,
  };
}

export class BhudhiTriggerRouter {
  async trigger(request: Doc12BhudhiTriggerRequest): Promise<BhudhiValidatedOutput> {
    if (!isDoc12Trigger(request.triggerType)) {
      throw new BhudhiRejected("UNREGISTERED_TRIGGER");
    }

    const triggerType = request.triggerType;
    const triggerDef = REGISTERED_TRIGGERS[triggerType];

    if (!isSourceAllowedForTrigger(triggerType, request.sourceEngine)) {
      throw new BhudhiRejected("SOURCE_NOT_ALLOWED");
    }

    const rawInput = { ...(request.facts ?? {}), ...(request.input ?? {}) };
    const contextPacket = await ContextBuilder.buildRouterContext({
      input: rawInput,
      triggerType,
      userId: request.userId,
      blueprintId: request.blueprintId,
    });

    const forceFallback =
      (await checkFeatureFlag("bhudhi_force_fallbacks")) ||
      (await checkFeatureFlag("degraded_mode"));
    if (forceFallback) {
      return {
        ok: true,
        data: FallbackLibrary.get(triggerType, contextPacket, request.stateVersion),
        logId: "",
        fallbackUsed: true,
        failureReason: "DEGRADED_MODE",
      };
    }

    const budgetOk = await BudgetController.checkAndReserve(request.userId);
    if (!budgetOk) {
      return {
        ok: true,
        data: FallbackLibrary.get(triggerType, contextPacket, request.stateVersion),
        logId: "",
        fallbackUsed: true,
        failureReason: "BUDGET_EXHAUSTED",
      };
    }

    const logId = await BhudhiLogWriter.startLog({
      userId: request.userId,
      blueprintId: request.blueprintId,
      triggerType,
      sourceEngine: request.sourceEngine,
      stateVersion: request.stateVersion,
    });

    try {
      const doc13Contract =       getPromptContract(triggerType);
      const pipelineResult = await runBhudhiPipeline(
        {
          sourceEngine: request.sourceEngine,
          triggerType,
          userId: request.userId,
          blueprintId: request.blueprintId,
          stateVersion: request.stateVersion,
          requestedMode: (request.requestedMode ?? triggerDef.mode) as never,
          userInput: request.userInput,
          facts: {
            ...contextPacket,
            stateVersion: request.stateVersion,
            doc12SystemPrompt: doc13Contract.buildSystemPrompt(contextPacket),
            doc13UserPrompt: doc13Contract.buildUserPrompt(contextPacket),
          },
          idempotencyKey: request.idempotencyKey,
        },
        { invokeModel: invokeBhudhiModel },
      );

      if (!pipelineResult.output) {
        await BhudhiLogWriter.failLog(logId, [pipelineResult.failureReason ?? "pipeline_empty_output"]);
        return {
          ok: pipelineResult.ok,
          data: FallbackLibrary.get(triggerType, contextPacket, request.stateVersion),
          logId: pipelineResult.logId || logId,
          fallbackUsed: true,
          failureReason: pipelineResult.failureReason,
        };
      }

      const validated = OutputValidator.validate(
        pipelineResult.output,
        triggerType,
        request.stateVersion,
      );

      if (!validated.ok || !validated.output) {
        await BhudhiLogWriter.failLog(logId, validated.errors);
        return {
          ok: true,
          data: FallbackLibrary.get(triggerType, contextPacket, request.stateVersion),
          logId: pipelineResult.logId || logId,
          fallbackUsed: true,
          failureReason: validated.errors.join("; ") || "OUTPUT_VALIDATION_FAILED",
        };
      }

      await BhudhiLogWriter.completeLog(pipelineResult.logId || logId, validated.output);
      return {
        ok: true,
        data: validated.output,
        logId: pipelineResult.logId || logId,
        fallbackUsed: pipelineResult.fallbackUsed,
        failureReason: pipelineResult.failureReason,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await BhudhiLogWriter.failLog(logId, [message]);
      return {
        ok: true,
        data: FallbackLibrary.get(triggerType, contextPacket, request.stateVersion),
        logId,
        fallbackUsed: true,
        failureReason: message,
      };
    }
  }
}

export const bhudhiTriggerRouter = new BhudhiTriggerRouter();

export function doc12ResultToTriggerResult(result: BhudhiValidatedOutput): BhudhiTriggerResult {
  return toPipelineResult({
    ok: result.ok,
    output: result.data,
    fallbackUsed: result.fallbackUsed,
    logId: result.logId,
    failureReason: result.failureReason,
  });
}

export { REGISTERED_TRIGGERS, isDoc12Trigger };
