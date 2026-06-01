import { db, taskGenerationLog } from "@workspace/db";
import { eq } from "drizzle-orm";

export function dailyCycleIdempotencyKey(blueprintId: string, dateUtc: string): string {
  return `daily:${blueprintId}:${dateUtc}`;
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function taskGenerationLogExists(idempotencyKey: string): Promise<boolean> {
  const [row] = await db
    .select({ key: taskGenerationLog.idempotency_key })
    .from(taskGenerationLog)
    .where(eq(taskGenerationLog.idempotency_key, idempotencyKey))
    .limit(1);
  return Boolean(row);
}

export async function recordDailyCycleIdempotency(params: {
  blueprintId: string;
  userId: string;
  idempotencyKey: string;
  ordersGenerated: number;
  conditionAtGeneration: string;
  enforcementPackageId?: string;
}): Promise<void> {
  await db
    .insert(taskGenerationLog)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      generation_mode: "daily",
      generation_trigger: "daily_cycle",
      condition_at_generation: params.conditionAtGeneration,
      enforcement_package_id: params.enforcementPackageId ?? null,
      capability_level: "starter",
      domain_at_generation: "general",
      input_json: { idempotency_key: params.idempotencyKey },
      orders_generated: params.ordersGenerated,
      order_ids: [],
      used_fallback: false,
      ai_used: false,
      idempotency_key: params.idempotencyKey,
    })
    .onConflictDoNothing();
}
