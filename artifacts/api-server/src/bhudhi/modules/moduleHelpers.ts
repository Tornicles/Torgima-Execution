import { db, bhudhiModules } from "@workspace/db";
import { eq } from "drizzle-orm";

export function resolvePhaseFromEventCount(eventCount: number): string {
  if (eventCount < 5) return "initiation";
  if (eventCount < 15) return "exploration";
  if (eventCount < 40) return "execution";
  if (eventCount < 80) return "optimization";
  return "scaling";
}

export function eventStatus(data: unknown): string | undefined {
  if (data === null || typeof data !== "object") return undefined;
  const status = (data as Record<string, unknown>)["status"];
  return typeof status === "string" ? status : undefined;
}

export async function recordModuleRun(
  moduleName: string,
  executionTimeMs: number,
): Promise<void> {
  const now = new Date();
  await db
    .update(bhudhiModules)
    .set({
      last_run_at: now,
      execution_time_ms: executionTimeMs,
      updated_at: now,
    })
    .where(eq(bhudhiModules.name, moduleName));
}
