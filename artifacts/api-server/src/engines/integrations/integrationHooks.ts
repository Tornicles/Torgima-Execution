/**
 * PROMPT 8 — Fire webhooks and automation when execution events occur.
 */
import { FEATURE_FLAGS } from "../../constants/feature-flags.js";
import { checkFeatureFlag } from "../../lib/utils.js";
import { executeAutomationFlows, triggerUserWebhooks } from "./IntegrationsEngine.js";

export async function onOrderCompleted(
  userId: string,
  context: {
    orderId: string;
    score: number;
    feedbackId?: string;
    blueprintId?: string | null;
  },
) {
  const on = await checkFeatureFlag(FEATURE_FLAGS.EXTERNAL_INTEGRATIONS_ENABLED);
  if (!on) return;

  const payload = {
    orderId: context.orderId,
    score: context.score,
    feedbackId: context.feedbackId,
    blueprintId: context.blueprintId,
    completedAt: new Date().toISOString(),
  };

  void triggerUserWebhooks(userId, "order-completed", payload).catch(() => null);
  void executeAutomationFlows(userId, "order-completed", payload).catch(() => null);
}

export async function onPrincipleApplied(userId: string, context: Record<string, unknown>) {
  const on = await checkFeatureFlag(FEATURE_FLAGS.EXTERNAL_INTEGRATIONS_ENABLED);
  if (!on) return;
  void triggerUserWebhooks(userId, "principle-applied", context).catch(() => null);
}
