import { failureRecoveryLayer } from "../services/erector/FailureRecoveryLayer.js";
import { logger } from "../lib/logger.js";
import { runValidationOrchestrator } from "../engines/erector/ErectorValidationOrchestrator.js";
import type { WorkerJobData, WorkerResult } from "./BaseWorkerHandler.js";

export async function handleErectorValidationRequestedJob(
  data: WorkerJobData,
): Promise<WorkerResult> {
  const sessionId =
    (data.payload.session_id as string | undefined) ??
    (data.entityType === "erector_intake_session" ? data.entityId : undefined);
  const userId = data.userId;
  const tier = (data.payload.tier as string | undefined) ?? "authenticated";

  if (!sessionId || !userId) {
    return { success: false, retryable: false, reason: "Missing intake validation context" };
  }

  const duplicate = await failureRecoveryLayer.findRecentCompletedValidationRun(sessionId);
  if (duplicate) {
    logger.info({ sessionId, validationRunId: duplicate.id }, "[ErectorValidationWorker] duplicate skipped");
    return { success: true, reason: "DUPLICATE_VALIDATION_RUN" };
  }

  try {
    const result = await runValidationOrchestrator(sessionId, userId, tier);
    logger.info(
      {
        sessionId,
        validationRunId: result.validation_run_id,
        verdict: result.verdict,
        launchContractId: result.launch_contract_id,
      },
      "[ErectorValidationWorker] orchestrator completed",
    );
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation orchestrator failed";

    if (message === "INTAKE_NOT_READY") {
      return { success: true, reason: "INTAKE_NOT_READY" };
    }

    const recovery = await failureRecoveryLayer.handleFailure({
      errorType: message.includes("RULE") ? "RULE_ENGINE_FAILURE" : "VALIDATION_TIMEOUT",
      sourceEngine: "ErectorValidationWorker",
      userId,
      entityType: "intake_session",
      entityId: sessionId,
      errorMessage: message,
    });

    logger.error({ err, sessionId, userId }, "[ErectorValidationWorker] orchestrator failed");
    return { success: false, retryable: recovery.retryable, reason: message };
  }
}
