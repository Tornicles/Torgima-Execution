import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { ExternalIntelligenceService } from "../bhudhi/ExternalIntelligenceService.js";
import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export const EIS_SCAN_QUEUE = "eis_scan";

workerRegistry.register({
  name: "EISWorker",
  queue: EIS_SCAN_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 5 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "EISWorker", async (data) => {
        const blueprintId = data.blueprintId ?? (data.payload as { blueprintId?: string })?.blueprintId;
        const userId = data.userId ?? (data.payload as { userId?: string })?.userId;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const existing = await ExternalIntelligenceService.getLatestForBlueprint(blueprintId);
        if (existing) {
          return { success: true };
        }

        const intel = await ExternalIntelligenceService.generateIntelligence({
          userId,
          blueprintId,
        });
        logger.info(
          { blueprintId, created: Boolean(intel) },
          "[EISWorker] Intelligence scan complete",
        );
        return { success: true };
      });
    }
  },
});

export async function queueEisScanForActiveBlueprints(): Promise<number> {
  const active = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

  const { getBoss } = await import("../lib/queue.js");
  const boss = await getBoss();
  await boss.createQueue(EIS_SCAN_QUEUE);

  let queued = 0;
  for (const bp of active) {
    await boss.send(EIS_SCAN_QUEUE, { blueprintId: bp.id, userId: bp.user_id });
    queued += 1;
  }
  return queued;
}
