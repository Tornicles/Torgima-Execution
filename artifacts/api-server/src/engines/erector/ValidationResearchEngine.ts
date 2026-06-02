import crypto from "crypto";
import { db, validationRuns, validations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { runErectorValidation } from "./ErectorOrchestrationService.js";
import type { ErectorValidationInput } from "../../types/erector.js";
import {
  patchValidationRunFromLegacyRow,
  syncValidationRunPanelsFromLegacyRow,
} from "./syncValidationRunPanels.js";

export type ValidationRunInput = {
  user_id: string;
  blueprint_draft_id?: string;
  idea_title: string;
  idea_description?: string;
  goal: string;
  purpose: string;
  timeframe: string;
  context?: string;
  commitment_level?: string;
  known_blockers?: string;
  /** Required when running full Erector pipeline */
  location?: { country: string; city?: string };
  businessType?: "online" | "offline" | "hybrid";
  businessModel?: string;
  budgetAvailable?: number;
  currency?: string;
  currentResources?: string[];
  targetCustomer?: string;
  tier?: "starter" | "growth" | "ultimate";
};

export type ValidationRunResult = {
  run_id: string;
  verdict: string;
  legacy_validation_id?: string;
};

async function updateRunStatus(runId: string, status: string): Promise<void> {
  await db.update(validationRuns).set({ status, updated_at: new Date() }).where(eq(validationRuns.id, runId));
}

function mapToErectorInput(runId: string, input: ValidationRunInput): ErectorValidationInput {
  if (!input.blueprint_draft_id) {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      "blueprint_draft_id is required to run Bhudhi-backed Erector validation",
      false,
    );
  }
  const country = input.location?.country ?? "Global";
  return {
    userId: input.user_id,
    blueprintId: input.blueprint_draft_id,
    idempotencyKey: `validation_run:${runId}`,
    rawGoal: input.goal,
    goalFinal: input.goal,
    purpose: input.purpose,
    purposeFinal: input.purpose,
    timeframe: input.timeframe as ErectorValidationInput["timeframe"],
    commitmentLevel: input.commitment_level ?? "MEDIUM",
    desiredOutcome: input.purpose,
    location: { country, city: input.location?.city },
    businessType: input.businessType ?? "online",
    businessModel: input.businessModel ?? input.idea_title,
    budgetAvailable: input.budgetAvailable ?? 0,
    currency: input.currency ?? "USD",
    currentResources: input.currentResources ?? [],
    targetCustomer: input.targetCustomer ?? input.goal,
    knownBlockers: input.known_blockers ? [input.known_blockers] : [],
    currentContext: input.context,
    domainHint: null,
    tier: input.tier ?? "starter",
  };
}

export class ValidationResearchEngine {
  async runFullValidation(input: ValidationRunInput & { run_id?: string }): Promise<ValidationRunResult> {
    let runId = input.run_id;

    if (!runId) {
      const [run] = await db
        .insert(validationRuns)
        .values({
          user_id: input.user_id,
          blueprint_draft_id: input.blueprint_draft_id ?? null,
          idea_title: input.idea_title,
          idea_description: input.idea_description ?? null,
          goal: input.goal,
          purpose: input.purpose,
          timeframe: input.timeframe,
          context: input.context ?? null,
          commitment_level: input.commitment_level ?? null,
          known_blockers: input.known_blockers ?? null,
          status: "pending",
        })
        .returning({ id: validationRuns.id });
      if (!run) throw new Error("Failed to create validation run");
      runId = run.id;
    }

    await updateRunStatus(runId, "running_analysis");
    await writeEvent({
      eventType: EVENT_TYPES.VALIDATION_PHASE_STARTED,
      entityType: "validation_run",
      entityId: runId,
      userId: input.user_id,
      blueprintId: input.blueprint_draft_id,
      payload: { phase: "analysis", run_id: runId },
      idempotencyKey: `validation_phase:${runId}:analysis`,
    }).catch(() => null);

    try {
      const erectorInput = mapToErectorInput(runId, input);
      const erectorResult = await runErectorValidation(erectorInput);

      const [legacyRow] = await db
        .select()
        .from(validations)
        .where(eq(validations.id, erectorResult.validationId))
        .limit(1);

      if (!legacyRow) {
        throw new TorgimaError("NOT_FOUND", "Erector validation row missing after run", true);
      }

      await updateRunStatus(runId, "running_reality_check");
      await writeEvent({
        eventType: EVENT_TYPES.VALIDATION_PHASE_STARTED,
        entityType: "validation_run",
        entityId: runId,
        userId: input.user_id,
        blueprintId: input.blueprint_draft_id,
        payload: { phase: "reality_check", run_id: runId },
        idempotencyKey: `validation_phase:${runId}:reality`,
      }).catch(() => null);

      await syncValidationRunPanelsFromLegacyRow(runId, legacyRow);

      await updateRunStatus(runId, "running_path_analysis");
      await writeEvent({
        eventType: EVENT_TYPES.VALIDATION_PHASE_STARTED,
        entityType: "validation_run",
        entityId: runId,
        userId: input.user_id,
        blueprintId: input.blueprint_draft_id,
        payload: { phase: "path_analysis", run_id: runId },
        idempotencyKey: `validation_phase:${runId}:paths`,
      }).catch(() => null);

      await patchValidationRunFromLegacyRow(runId, legacyRow);

      await writeEvent({
        eventType: EVENT_TYPES.VALIDATION_COMPLETED,
        entityType: "validation_run",
        entityId: runId,
        userId: input.user_id,
        blueprintId: input.blueprint_draft_id,
        payload: {
          run_id: runId,
          verdict: legacyRow.verdict,
          reality_score: legacyRow.reality_score,
          legacy_validation_id: legacyRow.id,
        },
        idempotencyKey: `validation_completed:${runId}`,
      }).catch(() => null);

      logger.info(
        { runId, validationId: legacyRow.id, verdict: legacyRow.verdict },
        "[ValidationResearch] Run complete",
      );

      return {
        run_id: runId,
        verdict: legacyRow.verdict ?? "adjust",
        legacy_validation_id: legacyRow.id,
      };
    } catch (err) {
      await updateRunStatus(runId, "failed");
      const message = err instanceof Error ? err.message : String(err);
      await writeEvent({
        eventType: EVENT_TYPES.VALIDATION_FAILED,
        entityType: "validation_run",
        entityId: runId,
        userId: input.user_id,
        blueprintId: input.blueprint_draft_id,
        payload: { run_id: runId, error: message },
        idempotencyKey: `validation_failed:${runId}`,
      }).catch(() => null);
      throw err instanceof TorgimaError
        ? err
        : new TorgimaError("INTERNAL_ERROR", message, true);
    }
  }
}

export function newValidationRunIdempotencyKey(): string {
  return crypto.randomUUID();
}
