import { db, validations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { runFullValidation } from "./intelligence/ValidationOrchestrator.js";
import { logValidationStage } from "./ValidationEventLogService.js";
import { recordVerdictEvolution } from "./VerdictEvolutionService.js";
import type { BlueprintTier } from "../blueprint/infrastructure/blueprint-types.js";

const STAGES = ["CIS", "IIS", "EIS", "SIS", "PIS"] as const;

async function runStageWithRetry<T>(
  stage: string,
  fn: () => Promise<T>,
  opts: { required: boolean; maxRetries: number },
): Promise<T | null> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < opts.maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }
  if (opts.required) throw lastErr;
  return null;
}

export async function runValidationPipeline(params: {
  validationId: string;
  blueprintId: string;
  userId: string;
  input: {
    goal: string;
    purpose?: string;
    timeframe?: string;
    commitmentLevel?: string;
    currentContext?: string;
    successSignal?: string;
    knownBlockers?: string;
    domainHint?: string | null;
  };
  tier?: BlueprintTier;
  mode?: string;
  aiEnabled: boolean;
}): Promise<{ status: string; validationId: string }> {
  const [existing] = await db
    .select({ verdict: validations.verdict, status: validations.status })
    .from(validations)
    .where(eq(validations.id, params.validationId))
    .limit(1);

  if (!existing) throw new TorgimaError("NOT_FOUND", "Validation session not found");

  const previousVerdict = existing.verdict;

  await db
    .update(validations)
    .set({ status: "running" })
    .where(eq(validations.id, params.validationId));

  for (const stage of STAGES) {
    await logValidationStage({
      validationId: params.validationId,
      blueprintId: params.blueprintId,
      userId: params.userId,
      stage,
      status: "RUNNING",
    });
  }

  try {
    await runStageWithRetry(
      "PIPELINE",
      async () => {
        const result = await runFullValidation({
          blueprintId: params.blueprintId,
          userId: params.userId,
          input: params.input,
          tier: params.tier,
          mode: params.mode,
          aiEnabled: params.aiEnabled,
        });

        if (result.validationId !== params.validationId) {
          logger.warn(
            { expected: params.validationId, actual: result.validationId },
            "[ValidationPipeline] validation id mismatch",
          );
        }

        await recordVerdictEvolution({
          validationId: params.validationId,
          blueprintId: params.blueprintId,
          userId: params.userId,
          previousVerdict,
          newVerdict: result.verdict,
        });

        for (const stage of STAGES) {
          const prog = result.intelligence.systemsProgress[stage as keyof typeof result.intelligence.systemsProgress];
          await logValidationStage({
            validationId: params.validationId,
            blueprintId: params.blueprintId,
            userId: params.userId,
            stage,
            status:
              prog === "complete" ? "COMPLETED"
              : prog === "running" ? "RUNNING"
              : "PENDING",
            confidence: result.scores.overall,
          });
        }

        await logValidationStage({
          validationId: params.validationId,
          blueprintId: params.blueprintId,
          userId: params.userId,
          stage: "COMPLETE",
          status: "COMPLETED",
          payload: { verdict: result.verdict, launchBlocked: result.launchBlocked },
        });

        return result;
      },
      { required: true, maxRetries: 0 },
    );

    await db
      .update(validations)
      .set({ status: "complete" })
      .where(eq(validations.id, params.validationId));

    return { status: "complete", validationId: params.validationId };
  } catch (err) {
    await db
      .update(validations)
      .set({ status: "failed" })
      .where(eq(validations.id, params.validationId));

    await logValidationStage({
      validationId: params.validationId,
      blueprintId: params.blueprintId,
      userId: params.userId,
      stage: "COMPLETE",
      status: "FAILED",
      message: err instanceof Error ? err.message : "Validation pipeline failed",
    });

    throw err;
  }
}
