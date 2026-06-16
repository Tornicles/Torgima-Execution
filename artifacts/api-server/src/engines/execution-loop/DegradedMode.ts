import { db, featureFlags } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { checkFeatureFlag } from "../../lib/utils.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { dispatchPendingEvents } from "../../services/EventDispatcher.js";
import { invalidateDashboardCache } from "../../services/dashboard-cache.js";

export const DEGRADED_MODE_FLAG = "degraded_mode";
const BHUDHI_FORCE_FALLBACKS = "bhudhi_force_fallbacks";

async function upsertFeatureFlag(
  name: string,
  enabled: boolean,
  description: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: featureFlags.id })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, name))
    .limit(1);

  if (existing) {
    await db
      .update(featureFlags)
      .set({ enabled, description, updated_at: new Date() })
      .where(eq(featureFlags.id, existing.id));
    return;
  }

  await db.insert(featureFlags).values({
    feature_name: name,
    enabled,
    description,
  });
}

export async function isDegradedMode(): Promise<boolean> {
  return checkFeatureFlag(DEGRADED_MODE_FLAG);
}

/** DOC17 Task 3 — activate degraded mode and force Bhudhi fallbacks. */
export async function activateDegradedMode(params: {
  reason: string;
  severity: "WARN" | "ERROR" | "CRITICAL";
  blueprintId?: string;
  userId?: string;
}): Promise<void> {
  const already = await isDegradedMode();
  await upsertFeatureFlag(
    DEGRADED_MODE_FLAG,
    true,
    `Degraded mode: ${params.reason} (${params.severity})`,
  );
  await upsertFeatureFlag(
    BHUDHI_FORCE_FALLBACKS,
    true,
    "System degraded — Bhudhi API calls disabled",
  );

  if (!already) {
    await writeEvent({
      eventType: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
      entityType: "system",
      entityId: "degraded_mode",
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: {
        reason: params.reason,
        severity: params.severity,
        degraded_mode: true,
      },
      idempotencyKey: `degraded_mode:on:${Math.floor(Date.now() / 60000)}`,
    }).catch(() => null);
  }

  logger.warn({ reason: params.reason, severity: params.severity }, "[DegradedMode] Activated");
}

/** DOC17 Task 3 — recover when health checks pass again. */
export async function recoverDegradedMode(userId?: string): Promise<void> {
  const wasDegraded = await isDegradedMode();
  if (!wasDegraded) return;

  await upsertFeatureFlag(DEGRADED_MODE_FLAG, false, "System recovered");
  await writeEvent({
    eventType: EVENT_TYPES.SYSTEM_HEALTH_RESTORED,
    entityType: "system",
    entityId: "degraded_mode",
    userId,
    payload: { degraded_mode: false },
    idempotencyKey: `degraded_mode:off:${Math.floor(Date.now() / 60000)}`,
  }).catch(() => null);

  if (userId) invalidateDashboardCache(userId);
  await dispatchPendingEvents().catch(() => null);

  logger.info("[DegradedMode] Recovered — replaying pending events");
}

export function degradedDashboardMessage(): string {
  return "System is updating. Your progress is preserved.";
}
