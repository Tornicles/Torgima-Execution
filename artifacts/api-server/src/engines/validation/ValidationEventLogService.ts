import { db, validationEventLogs } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const STAGE_MESSAGES: Record<string, string> = {
  CIS: "Analysing your context and industry fit…",
  IIS: "Refining your goal for measurable execution…",
  EIS: "Researching industry demand and competition…",
  SIS: "Generating strategic paths…",
  PIS: "Scoring probability and readiness…",
  COMPLETE: "Validation complete.",
};

export async function logValidationStage(params: {
  validationId: string;
  blueprintId: string;
  userId: string;
  stage: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
  confidence?: number;
  retryCount?: number;
  message?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(validationEventLogs).values({
    validation_id: params.validationId,
    blueprint_id: params.blueprintId,
    user_id: params.userId,
    stage: params.stage,
    status: params.status,
    message: params.message ?? STAGE_MESSAGES[params.stage] ?? params.stage,
    confidence: params.confidence ?? null,
    retry_count: params.retryCount ?? 0,
    payload_json: params.payload ?? {},
  });
}

export async function getValidationTimeline(validationId: string) {
  return db
    .select()
    .from(validationEventLogs)
    .where(eq(validationEventLogs.validation_id, validationId))
    .orderBy(desc(validationEventLogs.created_at));
}
