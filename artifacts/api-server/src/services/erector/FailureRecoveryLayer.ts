import { eq } from "drizzle-orm";
import { db, erectorSystemErrorRecords, erectorValidationRuns, idempotencyRecords } from "@workspace/db";
import { updateBlueprintErectorState } from "../../engines/erector/erectorStateMachine.js";
import { logger } from "../../lib/logger.js";

export const RETRY_POLICIES: Record<
  string,
  { max_retries: number; backoff_ms: number; recovery_action: string }
> = {
  VALIDATION_TIMEOUT: { max_retries: 3, backoff_ms: 5000, recovery_action: "retry" },
  SIMULATION_UNAVAILABLE: { max_retries: 3, backoff_ms: 10000, recovery_action: "retry" },
  BHUDHI_OUTPUT_MALFORMED: { max_retries: 2, backoff_ms: 2000, recovery_action: "fallback" },
  EVIDENCE_UPLOAD_FAILED: { max_retries: 3, backoff_ms: 3000, recovery_action: "retry" },
  SIGNAL_CALCULATION_FAILED: { max_retries: 3, backoff_ms: 2000, recovery_action: "retry" },
  EVENT_DELIVERY_FAILED: { max_retries: 5, backoff_ms: 1000, recovery_action: "retry" },
  DUPLICATE_VALIDATION_RUN: { max_retries: 0, backoff_ms: 0, recovery_action: "skip" },
  STATE_TRANSITION_FAILED: { max_retries: 1, backoff_ms: 1000, recovery_action: "manual_repair" },
  DATABASE_WRITE_FAILED: { max_retries: 3, backoff_ms: 2000, recovery_action: "retry" },
  RULE_ENGINE_FAILURE: { max_retries: 2, backoff_ms: 5000, recovery_action: "fallback" },
};

export interface FailureRecoveryInput {
  errorType: string;
  sourceEngine: string;
  userId?: string;
  blueprintId?: string;
  entityType?: string;
  entityId?: string;
  errorMessage: string;
  errorDetail?: Record<string, unknown>;
  idempotencyKey?: string;
  retryCount?: number;
}

export interface FailureRecoveryResult {
  retryable: boolean;
  recovery_action: string;
  backoff_ms: number;
  max_retries: number;
}

export class FailureRecoveryLayer {
  resolvePolicy(errorType: string) {
    return RETRY_POLICIES[errorType] ?? {
      max_retries: 2,
      backoff_ms: 2000,
      recovery_action: "retry",
    };
  }

  async handleFailure(input: FailureRecoveryInput): Promise<FailureRecoveryResult> {
    const policy = this.resolvePolicy(input.errorType);
    const retryCount = input.retryCount ?? 0;
    const retryable = retryCount < policy.max_retries && policy.recovery_action === "retry";

    await db.insert(erectorSystemErrorRecords).values({
      error_type: input.errorType,
      source_engine: input.sourceEngine,
      user_id: input.userId ?? null,
      blueprint_id: input.blueprintId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      error_message: input.errorMessage,
      error_detail: input.errorDetail ?? {},
      retry_count: retryCount,
      max_retries: policy.max_retries,
      recovery_action: policy.recovery_action,
      recovery_status: retryable ? "pending" : "failed",
      idempotency_key: input.idempotencyKey ?? null,
    });

    if (input.errorType === "RULE_ENGINE_FAILURE" && input.blueprintId) {
      await updateBlueprintErectorState(input.blueprintId, "SYSTEM_ERROR_BLOCKED");
    }

    if (input.errorType === "BHUDHI_OUTPUT_MALFORMED") {
      logger.warn(
        { entityId: input.entityId, userId: input.userId },
        "[FailureRecoveryLayer] Bhudhi fallback path engaged",
      );
    }

    return {
      retryable,
      recovery_action: policy.recovery_action,
      backoff_ms: policy.backoff_ms,
      max_retries: policy.max_retries,
    };
  }

  async getCachedIdempotentResult<T extends Record<string, unknown>>(
    key: string,
  ): Promise<T | null> {
    const [row] = await db
      .select({ result: idempotencyRecords.result })
      .from(idempotencyRecords)
      .where(eq(idempotencyRecords.key, key))
      .limit(1);
    return (row?.result as T | undefined) ?? null;
  }

  async findRecentCompletedValidationRun(sessionId: string) {
    const [row] = await db
      .select()
      .from(erectorValidationRuns)
      .where(eq(erectorValidationRuns.intake_session_id, sessionId))
      .limit(1);
    if (!row) return null;
    if (row.status !== "complete") return null;
    if (row.created_at.getTime() < Date.now() - 60 * 60 * 1000) return null;
    return row;
  }
}

export const failureRecoveryLayer = new FailureRecoveryLayer();

export async function preventDuplicateValidationRun(sessionId: string) {
  return failureRecoveryLayer.findRecentCompletedValidationRun(sessionId);
}
