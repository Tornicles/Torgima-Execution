import { db, validations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { runValidationPipeline } from "../engines/validation/ValidationPipelineRunner.js";
import { getAiEnabled } from "../services/ValidationService.js";
import { logger } from "../lib/logger.js";
import type { BlueprintTier } from "../engines/blueprint/infrastructure/blueprint-types.js";

export const VALIDATION_QUEUE = "validation_start_requested";

workerRegistry.register({
  name: "ValidationQueueWorker",
  queue: VALIDATION_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ValidationQueueWorker", async (data) => {
        const validationId = data.entityId ?? (data.payload?.validation_id as string | undefined);
        const blueprintId = data.blueprintId;
        const userId = data.userId;

        if (!validationId || !blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing validation context" };
        }

        const [row] = await db
          .select()
          .from(validations)
          .where(eq(validations.id, validationId))
          .limit(1);

        if (!row) {
          return { success: false, retryable: false, reason: "Validation row not found" };
        }

        const payload = data.payload as {
          input?: Record<string, unknown>;
          tier?: BlueprintTier;
          mode?: string;
        };

        const input = payload?.input ?? {};
        const aiEnabled = await getAiEnabled();

        await runValidationPipeline({
          validationId,
          blueprintId,
          userId,
          input: {
            goal: String(input.goal ?? ""),
            purpose: input.purpose as string | undefined,
            timeframe: input.timeframe as string | undefined,
            commitmentLevel: input.commitmentLevel as string | undefined,
            currentContext: input.currentContext as string | undefined,
            successSignal: input.successSignal as string | undefined,
            knownBlockers: input.knownBlockers as string | undefined,
            domainHint: (input.domainHint as string | null) ?? null,
          },
          tier: payload?.tier,
          mode: payload?.mode,
          aiEnabled,
        });

        logger.info({ validationId, blueprintId }, "[ValidationQueueWorker] Pipeline complete");
        return { success: true };
      });
    }
  },
});
