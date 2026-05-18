import { db, fallbackUsageLogs } from "@workspace/db";

export async function logFallbackUsage(params: {
  triggerType: string;
  promptName: string;
  reason: string;
  fallbackType?: string;
  userId?: string;
  bhudhiLogId?: string;
}): Promise<void> {
  await db.insert(fallbackUsageLogs).values({
    trigger_type: params.triggerType,
    prompt_name: params.promptName,
    reason: params.reason.slice(0, 500),
    fallback_type: params.fallbackType ?? "DETERMINISTIC_TEMPLATE",
    user_id: params.userId,
    bhudhi_log_id: params.bhudhiLogId,
  });
}
