import { db } from "@workspace/db";
import { validations, blueprints, featureFlags } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { TorgimaError } from "../lib/errors.js";
import { validatePayload } from "../lib/validationPayloadSchemas.js";
import {
  runValidation,
  structureGoalWithBhudhi,
  structureGoalDeterministic,
  scoreToVerdict,
} from "../engines/validation/ValidationEngine.js";
import { buildValidationToBlueprintContract } from "../engines/validation/intelligence/ValidationToBlueprintBridge.js";
import type {
  ValidationResult,
  OnboardingGoalInput,
  StructuredGoalDraft,
} from "../types/validation.js";
import type { BlueprintTier } from "../engines/blueprint/infrastructure/blueprint-types.js";
import type { ValidationIntelligencePayload } from "../engines/validation/intelligence/validation-intelligence-types.js";
import { parseTier } from "../engines/blueprint/BlueprintRuleEngine.js";
import { recordValidationMemory } from "../engines/validation/ValidationMemoryService.js";
import { recordStrategicAssumptions } from "../engines/validation/AssumptionMonitoringService.js";
import { validations as validationsTable } from "@workspace/db";
import { writeEvent, EVENT_TYPES } from "./EventService.js";
import { BlueprintStatus, ErectorValidationStage, ValidationKind, ValidationStatus } from "@workspace/state-machine";
import { ValidationFinalizationService } from "./ValidationFinalizationService.js";

export async function getAiEnabled(): Promise<boolean> {
  const rows = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1);
  return rows[0]?.enabled ?? false;
}

function rowToResult(row: typeof validations.$inferSelect, blueprintId: string): ValidationResult {
  const c = row.clarity_score ?? 0;
  const f = row.feasibility_score ?? 0;
  const r = row.realism_score ?? 0;
  const overall = Math.round((c + f + r) / 3);
  const intel = row.intelligence_payload as ValidationIntelligencePayload | null;

  return {
    validationId: row.id,
    validationContractId: row.contract_id,
    blueprintId,
    verdict: (row.verdict ?? "adjust") as ValidationResult["verdict"],
    scores: {
      clarity: { score: c, verdict: scoreToVerdict(c), finding: "" },
      feasibility: { score: f, verdict: scoreToVerdict(f), finding: "" },
      realism: { score: r, verdict: scoreToVerdict(r), finding: "" },
      usefulness: { score: 0, verdict: "acceptable", finding: "" },
      overall,
    },
    paths: {
      current: (row.path_current as ValidationResult["paths"]["current"]) ?? null!,
      adjusted: (row.path_adjusted as ValidationResult["paths"]["adjusted"]) ?? null!,
      alternative: (row.path_alternative as ValidationResult["paths"]["alternative"]) ?? null!,
    },
    usedFallback: false,
    aiSummary: row.ai_summary ?? undefined,
    createdAt: row.created_at,
    launchBlocked: row.launch_blocked ?? false,
    readiness: row.readiness ?? intel?.readiness,
    intelligence: intel as unknown as Record<string, unknown>,
    industryPanel: intel?.industryPanel as unknown as Record<string, unknown>,
    tabs: intel?.tabs as unknown as Record<string, unknown>,
    blueprintContract: row.blueprint_contract as Record<string, unknown> | null,
    systemsProgress: intel?.systemsProgress,
  };
}

function isErectorValidationComplete(row: typeof validations.$inferSelect): boolean {
  if (row.validation_kind !== ValidationKind.ERECTOR) return false;
  const stage = row.erector_validation_stage ?? row.validation_stage ?? row.status;
  return (
    stage === ErectorValidationStage.COMPLETE ||
    stage === ValidationStatus.COMPLETE ||
    stage === "complete"
  );
}

function isIntelligenceValidationComplete(row: typeof validations.$inferSelect): boolean {
  return (
    row.validation_kind === ValidationKind.INTELLIGENCE && row.status === ValidationStatus.COMPLETE
  );
}

/** Resolve validation row for path selection / launch (Erector + Intelligence). */
async function findValidationForBlueprint(params: {
  blueprintId?: string;
  userId: string;
  validationContractId?: string;
  validationIdHint?: string;
}): Promise<typeof validations.$inferSelect | null> {
  const { blueprintId, userId, validationContractId, validationIdHint } = params;

  logger.info(
    { blueprintId: blueprintId || null, userId, validationContractId, validationIdHint },
    "[LAUNCH] Looking up validation record",
  );

  if (validationIdHint) {
    const [byId] = await db
      .select()
      .from(validations)
      .where(and(eq(validations.id, validationIdHint), eq(validations.user_id, userId)))
      .limit(1);
    if (byId) {
      logger.info({ validationId: byId.id, kind: byId.validation_kind }, "[LAUNCH] Found by validation id");
      return byId;
    }
    const [byContractAsId] = await db
      .select()
      .from(validations)
      .where(and(eq(validations.contract_id, validationIdHint), eq(validations.user_id, userId)))
      .limit(1);
    if (byContractAsId) {
      logger.info(
        { validationId: byContractAsId.id, kind: byContractAsId.validation_kind },
        "[LAUNCH] Found by contract_id matching URL id",
      );
      return byContractAsId;
    }
  }

  if (validationContractId && blueprintId) {
    const [byContract] = await db
      .select()
      .from(validations)
      .where(
        and(eq(validations.contract_id, validationContractId), eq(validations.blueprint_id, blueprintId)),
      )
      .limit(1);
    if (byContract) {
      logger.info({ validationId: byContract.id, kind: byContract.validation_kind }, "[LAUNCH] Found by contract_id");
      return byContract;
    }
  }

  if (!blueprintId) {
    const [fallbackUser] = await db
      .select()
      .from(validations)
      .where(eq(validations.user_id, userId))
      .orderBy(desc(validations.updated_at))
      .limit(1);
    if (fallbackUser) {
      logger.warn(
        { validationId: fallbackUser.id, blueprintId: fallbackUser.blueprint_id },
        "[LAUNCH] Fallback — user's most recent validation (no blueprint id in request)",
      );
    }
    return fallbackUser ?? null;
  }

  const blueprintRows = await db
    .select()
    .from(validations)
    .where(and(eq(validations.blueprint_id, blueprintId), eq(validations.user_id, userId)))
    .orderBy(desc(validations.updated_at))
    .limit(10);

  const completeForBlueprint = blueprintRows.find(
    (row) => isErectorValidationComplete(row) || isIntelligenceValidationComplete(row),
  );
  if (completeForBlueprint) {
    logger.info(
      { validationId: completeForBlueprint.id, kind: completeForBlueprint.validation_kind },
      "[LAUNCH] Found latest complete validation for blueprint",
    );
    return completeForBlueprint;
  }

  const [fallbackUser] = await db
    .select()
    .from(validations)
    .where(eq(validations.user_id, userId))
    .orderBy(desc(validations.updated_at))
    .limit(1);

  if (fallbackUser) {
    logger.warn(
      { validationId: fallbackUser.id, blueprintId: fallbackUser.blueprint_id },
      "[LAUNCH] Fallback — using user's most recent validation row",
    );
  }

  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(validations);
  const sample = await db.select({ id: validations.id }).from(validations).limit(5);
  logger.info(
    {
      found: Boolean(fallbackUser),
      totalValidations: countRow?.count ?? 0,
      sampleIds: sample.map((s) => s.id),
    },
    "[LAUNCH] DB validation inventory",
  );

  return fallbackUser ?? null;
}

function assertIntelligencePayload(row: typeof validations.$inferSelect): ValidationIntelligencePayload {
  if (row.validation_kind !== ValidationKind.INTELLIGENCE) {
    throw new TorgimaError("VALIDATION_ERROR", `Validation ${row.id} is ${row.validation_kind}, not intelligence`);
  }

  const payloadCheck = validatePayload(ValidationKind.INTELLIGENCE, row.intelligence_payload);
  if (!payloadCheck.success) {
    throw new TorgimaError(
      "VALIDATION_PAYLOAD_CORRUPT",
      `Intelligence payload failed schema check: ${payloadCheck.error.message}`,
    );
  }

  return row.intelligence_payload as ValidationIntelligencePayload;
}

export const ValidationService = {
  async structureGoal(params: {
    userId: string;
    blueprintId?: string;
    input: OnboardingGoalInput;
    aiEnabled?: boolean;
  }): Promise<StructuredGoalDraft> {
    const aiEnabled = params.aiEnabled ?? (await getAiEnabled());
    if (aiEnabled) {
      return structureGoalWithBhudhi({
        ...params.input,
        userId: params.userId,
        blueprintId: params.blueprintId,
      });
    }
    return structureGoalDeterministic(params.input);
  },

  async validateGoal(params: {
    blueprintId: string;
    userId: string;
    tier?: BlueprintTier;
    mode?: string;
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
  }): Promise<ValidationResult> {
    const bpRows = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);
    if (!bpRows[0]) throw new TorgimaError("NOT_FOUND", "Blueprint not found");

    const aiEnabled = await getAiEnabled();
    return runValidation({
      blueprintId: params.blueprintId,
      userId: params.userId,
      input: params.input,
      aiEnabled,
      tier: params.tier,
      mode: params.mode,
    });
  },

  async startValidation(params: {
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
  }): Promise<{ sessionId: string; status: string }> {
    const [inserted] = await db
      .insert(validationsTable)
      .values({
        blueprint_id: params.blueprintId,
        user_id: params.userId,
        status: ValidationStatus.QUEUED,
        validation_kind: ValidationKind.INTELLIGENCE,
        payload_version: 1,
        tier: params.tier ?? null,
      })
      .returning({ id: validationsTable.id });

    if (!inserted) throw new TorgimaError("INTERNAL_ERROR", "Failed to queue validation");

    await writeEvent({
      eventType: EVENT_TYPES.VALIDATION_START_REQUESTED,
      entityType: "validation",
      entityId: inserted.id,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: {
        validation_id: inserted.id,
        input: params.input,
        tier: params.tier,
        mode: params.mode,
      },
      idempotencyKey: `validation_start:${params.blueprintId}:${inserted.id}`,
    });

    return { sessionId: inserted.id, status: ValidationStatus.QUEUED };
  },

  async getValidationStatus(validationId: string, userId: string) {
    const [row] = await db
      .select()
      .from(validations)
      .where(eq(validations.id, validationId))
      .limit(1);
    if (!row || row.user_id !== userId) throw new TorgimaError("NOT_FOUND", "Validation session not found");
    const intel = row.intelligence_payload as ValidationIntelligencePayload | null;
    return {
      validationId: row.id,
      validationContractId: row.contract_id,
      status: row.status,
      systemsProgress: intel?.systemsProgress ?? {},
      readiness: row.readiness,
      verdict: row.verdict,
    };
  },

  findValidationForBlueprint,

  /** Select path + finalize — required before BlueprintLaunchService.launch in tests and direct launch paths. */
  async prepareForBlueprintLaunch(params: {
    blueprintId: string;
    userId: string;
    validationId: string;
    validationContractId: string;
    selectedPathType: "current" | "adjusted" | "alternative";
    confirmAdjusted?: boolean;
  }): Promise<typeof validations.$inferSelect> {
    await this.selectValidationPath({
      blueprintId: params.blueprintId,
      userId: params.userId,
      selectedPath: params.selectedPathType,
      validationContractId: params.validationContractId,
      validationIdHint: params.validationId,
      confirmAdjusted: params.confirmAdjusted ?? params.selectedPathType === "adjusted",
    });
    return ValidationFinalizationService.finalizeValidation(params.validationId, params.userId, {
      selectedPath: params.selectedPathType,
    });
  },

  async selectValidationPath(params: {
    blueprintId: string;
    userId: string;
    selectedPath: "current" | "adjusted" | "alternative";
    confirmAdjusted?: boolean;
    validationContractId?: string;
    validationIdHint?: string;
  }): Promise<{ selected: boolean; blueprintContract: Record<string, unknown> | null }> {
    const bpRows = await db
      .select({ id: blueprints.id, status: blueprints.status, goal: blueprints.goal })
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);

    const bp = bpRows[0];
    if (!bp) throw new TorgimaError("NOT_FOUND", "Blueprint not found");

    if (
      bp.status !== BlueprintStatus.PATH_SELECTION &&
      bp.status !== BlueprintStatus.AWAITING_SELECTION &&
      bp.status !== BlueprintStatus.DRAFT &&
      bp.status !== BlueprintStatus.VALIDATING
    ) {
      throw new TorgimaError("STALE_STATE", `Blueprint is not in path selection state (current: ${bp.status})`);
    }

    const validation = await findValidationForBlueprint({
      blueprintId: params.blueprintId,
      userId: params.userId,
      validationContractId: params.validationContractId,
      validationIdHint: params.validationIdHint,
    });

    if (!validation) {
      logger.error(
        { blueprintId: params.blueprintId, validationContractId: params.validationContractId },
        "[LAUNCH] Validation record not found — NOT IN DB",
      );
      throw new TorgimaError("NOT_FOUND", "Validation record not found. Run validation first.");
    }

    if ((validation.launch_blocked || validation.verdict === "pivot") && params.selectedPath !== "alternative") {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Cannot select current or adjusted path while verdict is Pivot Required. Select alternative or re-validate.",
      );
    }

    if (validation.verdict === "adjust" && params.selectedPath === "current" && !params.confirmAdjusted) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Verdict is Adjust — confirm the adjusted path or select adjusted explicitly.",
      );
    }

    let blueprintContract = validation.blueprint_contract as Record<string, unknown> | null;

    if (validation.validation_kind === ValidationKind.ERECTOR) {
      await db
        .update(validations)
        .set({
          selected_path: params.selectedPath,
          selected_path_type: params.selectedPath,
          selected_at: new Date(),
          adjusted_path_confirmed:
            params.selectedPath === "adjusted" || Boolean(params.confirmAdjusted),
          readiness:
            validation.verdict === "adjust" && params.selectedPath !== "adjusted" ?
              "ready_with_adjustment"
            : "ready_proceed",
        })
        .where(eq(validations.id, validation.id));
    } else {
      const intel = assertIntelligencePayload(validation);

      if (intel) {
        const contract = buildValidationToBlueprintContract({
          intelligence: intel,
          selectedPath: params.selectedPath,
          paths: intel.paths,
          tier: parseTier(validation.tier ?? intel.tier),
        });
        blueprintContract = contract as unknown as Record<string, unknown>;
      }

      await db
        .update(validations)
        .set({
          selected_path: params.selectedPath,
          selected_path_type: params.selectedPath,
          selected_at: new Date(),
          blueprint_contract: blueprintContract,
          adjusted_path_confirmed:
            params.selectedPath === "adjusted" || Boolean(params.confirmAdjusted),
          readiness:
            validation.verdict === "adjust" && params.selectedPath !== "adjusted" ?
              "ready_with_adjustment"
            : "ready_proceed",
        })
        .where(eq(validations.id, validation.id));

      const goalText = bp.goal ?? "";
      await recordValidationMemory({
        userId: params.userId,
        blueprintId: params.blueprintId,
        validationId: validation.id,
        rawGoal: goalText,
        verdict: validation.verdict,
        clarityScore: validation.clarity_score,
        feasibilityScore: validation.feasibility_score,
        realismScore: validation.realism_score,
        industryLabel:
          (intel?.industryPanel as { industryLabel?: string } | undefined)?.industryLabel ?? null,
        selectedPath: params.selectedPath,
        payload: { selected_path: params.selectedPath },
      }).catch(() => null);

      const assumptions =
        (intel as { strategic_assumptions?: string[] } | null)?.strategic_assumptions ??
        (intel?.paths?.current as { strategic_assumptions?: string[] } | undefined)
          ?.strategic_assumptions ??
        [];

      if (assumptions.length > 0) {
        await recordStrategicAssumptions({
          userId: params.userId,
          blueprintId: params.blueprintId,
          validationId: validation.id,
          assumptions,
          industryContext:
            (intel?.industryPanel as { industryLabel?: string } | undefined)?.industryLabel ?? null,
        }).catch(() => null);
      }
    }

    logger.info({ blueprintId: params.blueprintId, selectedPath: params.selectedPath }, "[ValidationService] Path selected");

    await db
      .update(blueprints)
      .set({
        selected_path: params.selectedPath,
        status: BlueprintStatus.PATH_SELECTION,
      })
      .where(and(eq(blueprints.id, params.blueprintId), eq(blueprints.user_id, params.userId)));

    return { selected: true, blueprintContract };
  },

  async getValidationResult(params: {
    blueprintId: string;
    userId: string;
  }): Promise<ValidationResult | null> {
    const bpRows = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);
    if (!bpRows[0]) throw new TorgimaError("NOT_FOUND", "Blueprint not found");

    const valRows = await db
      .select()
      .from(validations)
      .where(
        and(
          eq(validations.blueprint_id, params.blueprintId),
          eq(validations.validation_kind, ValidationKind.INTELLIGENCE),
          eq(validations.status, ValidationStatus.COMPLETE),
        ),
      )
      .orderBy(desc(validations.created_at))
      .limit(1);

    const row = valRows[0];
    if (!row) return null;
    return rowToResult(row, params.blueprintId);
  },

  async getIndustryIntelligence(blueprintId: string, userId: string) {
    const result = await this.getValidationResult({ blueprintId, userId });
    if (!result?.industryPanel) throw new TorgimaError("NOT_FOUND", "Industry intelligence not available");
    return { panel: result.industryPanel, eis: (result.intelligence as { eis?: unknown })?.eis };
  },

  async getValidationByContractId(contractId: string): Promise<typeof validations.$inferSelect> {
    const [row] = await db
      .select()
      .from(validations)
      .where(eq(validations.contract_id, contractId))
      .limit(1);

    if (!row) {
      throw new TorgimaError("CONTRACT_NOT_FOUND", `No validation found for contract_id: ${contractId}`);
    }

    return row;
  },

  async assertLaunchAllowed(blueprintId: string, userId: string, validationContractId: string): Promise<void> {
    const row = await this.getValidationByContractId(validationContractId);

    if (!row) {
      throw new TorgimaError("VALIDATION_ERROR", "Validation must complete before blueprint launch.");
    }
    if (row.user_id !== userId) throw new TorgimaError("FORBIDDEN", "Not your validation");
    if (row.blueprint_id !== blueprintId) {
      throw new TorgimaError("FORBIDDEN", "validation_contract_id does not belong to this blueprint");
    }

    if (row.validation_kind === ValidationKind.ERECTOR) {
      const stage = row.erector_validation_stage ?? row.validation_stage;
      if (stage !== ErectorValidationStage.COMPLETE && stage !== ValidationStatus.COMPLETE && stage !== "complete") {
        throw new TorgimaError("VALIDATION_ERROR", "Erector validation must complete before blueprint launch.");
      }
      if (row.verdict === "blocked" || (row.reality_score != null && row.reality_score < 2.5)) {
        throw new TorgimaError(
          "VALIDATION_ERROR",
          "Blueprint launch blocked: Reality Score below 2.5. Re-validate with a feasible goal.",
        );
      }
      if (!row.selected_path) {
        throw new TorgimaError("VALIDATION_ERROR", "Select a validation path before launching.");
      }
      if (row.verdict === "pivot" && row.selected_path !== "alternative") {
        throw new TorgimaError(
          "VALIDATION_ERROR",
          "Blueprint launch blocked: Pivot Required. Select an alternative path or re-validate.",
        );
      }
      if (row.verdict === "adjust" && row.selected_path === "current" && !row.adjusted_path_confirmed) {
        throw new TorgimaError("VALIDATION_ERROR", "Confirm adjusted path before launch.");
      }
      return;
    }

    const intel = assertIntelligencePayload(row);

    if ((row.launch_blocked || row.verdict === "pivot") && row.selected_path !== "alternative") {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Blueprint launch blocked: Pivot Required. Select an alternative path or re-validate.",
      );
    }

    if (!row.selected_path) {
      throw new TorgimaError("VALIDATION_ERROR", "Select a validation path before launching.");
    }

    if (row.verdict === "adjust" && row.selected_path === "current" && !row.adjusted_path_confirmed) {
      throw new TorgimaError("VALIDATION_ERROR", "Confirm adjusted path before launch.");
    }

    const critical = (intel.pis?.risk_flags ?? []).filter(
      (r) => r.level === "critical" && !r.resolvable,
    );
    if (critical.length > 0) {
      throw new TorgimaError("VALIDATION_ERROR", "Critical unresolved risk blocks launch.");
    }
  },

  async validate(rawGoal: string, domain: string | null): Promise<{
    valid: boolean;
    score: number;
    feedback: string;
    suggestedDomain: string | null;
    refinedGoal: string | null;
    issues: string[];
  }> {
    const { scoreGoal, determineVerdict } = await import("../engines/validation/ValidationEngine.js");
    const scores = scoreGoal({ goal: rawGoal });
    const verdict = determineVerdict(scores);
    return {
      valid: verdict !== "pivot",
      score: scores.overall,
      feedback: scores.clarity.finding,
      suggestedDomain: domain,
      refinedGoal: null,
      issues: [
        ...(scores.clarity.suggestion ? [scores.clarity.suggestion] : []),
        ...(scores.feasibility.suggestion ? [scores.feasibility.suggestion] : []),
      ],
    };
  },
};
