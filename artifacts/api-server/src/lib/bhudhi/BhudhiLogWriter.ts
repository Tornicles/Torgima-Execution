import { logUsage, updateBhudhiLog } from "../../bhudhi/UsageController.js";
import { getContract } from "../../bhudhi/PromptRegistry.js";
import type { BhudhiValidationStatus } from "./BhudhiRuntimePolicy.js";
import type { Doc12TriggerType } from "./TriggerRegistry.js";

export async function startLog(params: {
  userId: string;
  blueprintId?: string;
  triggerType: Doc12TriggerType | string;
  sourceEngine: string;
  stateVersion: number;
}): Promise<string> {
  const contract = getContract(params.triggerType as never);
  return logUsage({
    userId: params.userId,
    blueprintId: params.blueprintId,
    triggerType: params.triggerType,
    sourceEngine: params.sourceEngine,
    promptName: contract?.name ?? String(params.triggerType),
    promptVersion: contract?.version ?? "1.0",
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
    status: "pending",
  }).catch(() => "");
}

export async function completeLog(logId: string, output: unknown): Promise<void> {
  if (!logId) return;
  await updateBhudhiLog({
    logId,
    status: "success",
    outputJson: { envelope: output },
  }).catch(() => undefined);
}

export async function completeFallbackLog(
  logId: string,
  params: {
    reason: string;
    validationStatus?: BhudhiValidationStatus;
    latencyMs?: number;
    output?: unknown;
  },
): Promise<void> {
  if (!logId) return;
  const status =
    params.validationStatus === "forced_fallback" ||
    params.validationStatus === "budget_blocked" ||
    params.validationStatus === "provider_error" ||
    params.validationStatus === "schema_error"
      ? "fallback"
      : "fallback";
  await updateBhudhiLog({
    logId,
    status,
    fallbackReason: params.reason,
    errorCode: params.validationStatus ?? "fallback_success",
    latencyMs: params.latencyMs,
    outputJson: params.output ? { envelope: params.output, mode: params.validationStatus } : undefined,
  }).catch(() => undefined);
}

export async function failLog(
  logId: string,
  errors: string[],
  opts?: { useFallbackStatus?: boolean },
): Promise<void> {
  if (!logId) return;
  await updateBhudhiLog({
    logId,
    status: opts?.useFallbackStatus ? "fallback" : "error",
    fallbackReason: errors.join("; "),
    errorCode: opts?.useFallbackStatus ? "schema_error" : "OUTPUT_VALIDATION_FAILED",
  }).catch(() => undefined);
}

export const BhudhiLogWriter = {
  startLog,
  completeLog,
  completeFallbackLog,
  failLog,
};
