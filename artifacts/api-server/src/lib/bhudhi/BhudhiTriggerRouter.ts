import { invokeBhudhiModel, runBhudhiPipeline } from "../../bhudhi/BhudhiCore.js";
import type { BhudhiOutputEnvelope, BhudhiTriggerResult } from "../../types/bhudhi.js";
import { BhudhiLogWriter } from "./BhudhiLogWriter.js";
import { BhudhiRejected } from "./BhudhiRejected.js";
import { BudgetController } from "./BudgetController.js";
import { ContextBuilder } from "./ContextBuilder.js";
import { FallbackLibrary } from "./FallbackLibrary.js";
import { OutputValidator } from "./OutputValidator.js";
import { getPromptContract } from "./prompts/PromptContracts.js";
import {
  CORE_DOC12_ROUTER_TRIGGERS,
  REGISTERED_TRIGGERS,
  type Doc12TriggerType,
  isDoc12Trigger,
  isSourceAllowedForTrigger,
} from "./TriggerRegistry.js";
import {
  mapFailureToValidationStatus,
  resolveBhudhiRuntimePolicy,
} from "./BhudhiRuntimePolicy.js";
import { logUsage } from "../../bhudhi/UsageController.js";
import { getContract } from "../../bhudhi/PromptRegistry.js";

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

    const triggerType = request.triggerType as Doc12TriggerType;
    const triggerDef = CORE_DOC12_ROUTER_TRIGGERS[triggerType];

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

    const forcePolicy = await resolveBhudhiRuntimePolicy();
    if (forcePolicy.forceFallback) {
      const fallbackData = FallbackLibrary.get(triggerType, contextPacket, request.stateVersion);
      const contract = getContract(triggerType);
      const logId = await logUsage({
        userId: request.userId,
        blueprintId: request.blueprintId,
        triggerType,
        sourceEngine: request.sourceEngine,
        promptName: contract?.name ?? String(triggerType),
        promptVersion: contract?.version ?? "1.0",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        status: "fallback",
        fallbackReason: forcePolicy.reason ?? forcePolicy.mode,
      }).catch(() => "");
      return {
        ok: true,
        data: fallbackData,
        logId,
        fallbackUsed: true,
        failureReason: forcePolicy.reason ?? "DEGRADED_MODE",
      };
    }

    const budgetOk = await BudgetController.checkAndReserve(request.userId);
    if (!budgetOk) {
      const fallbackData = FallbackLibrary.get(triggerType, contextPacket, request.stateVersion);
      const contract = getContract(triggerType);
      const logId = await logUsage({
        userId: request.userId,
        blueprintId: request.blueprintId,
        triggerType,
        sourceEngine: request.sourceEngine,
        promptName: contract?.name ?? String(triggerType),
        promptVersion: contract?.version ?? "1.0",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        status: "fallback",
        fallbackReason: "BUDGET_EXHAUSTED",
      }).catch(() => "");
      return {
        ok: true,
        data: fallbackData,
        logId,
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
        await BhudhiLogWriter.failLog(logId, validated.errors, { useFallbackStatus: true });
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
      const validationStatus = mapFailureToValidationStatus(message, true);
      await BhudhiLogWriter.completeFallbackLog(logId, {
        reason: message,
        validationStatus,
      });
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
