import { db } from "@workspace/db";
import { validations, blueprints, featureFlags } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { TorgimaError } from "../lib/errors.js";
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

export const ValidationService = {
  async structureGoal(params: {
    userId: string;
    input: OnboardingGoalInput;
    aiEnabled?: boolean;
  }): Promise<StructuredGoalDraft> {
    const aiEnabled = params.aiEnabled ?? (await getAiEnabled());
    if (aiEnabled) {
      return structureGoalWithBhudhi({ ...params.input, userId: params.userId });
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
        status: "queued",
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

    return { sessionId: inserted.id, status: "queued" };
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
      status: row.status,
      systemsProgress: intel?.systemsProgress ?? {},
      readiness: row.readiness,
      verdict: row.verdict,
    };
  },

  async selectValidationPath(params: {
    blueprintId: string;
    userId: string;
    selectedPath: "current" | "adjusted" | "alternative";
    confirmAdjusted?: boolean;
  }): Promise<{ selected: boolean; blueprintContract: Record<string, unknown> | null }> {
    const bpRows = await db
      .select({ id: blueprints.id, status: blueprints.status, goal: blueprints.goal })
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);

    const bp = bpRows[0];
    if (!bp) throw new TorgimaError("NOT_FOUND", "Blueprint not found");

    if (
      bp.status !== "path_selection" &&
      bp.status !== "awaiting_selection" &&
      bp.status !== "draft"
    ) {
      throw new TorgimaError("STALE_STATE", `Blueprint is not in path selection state (current: ${bp.status})`);
    }

    const validationRows = await db
      .select()
      .from(validations)
      .where(eq(validations.blueprint_id, params.blueprintId))
      .orderBy(desc(validations.created_at))
      .limit(1);

    const validation = validationRows[0];
    if (!validation) {
      throw new TorgimaError("NOT_FOUND", "Validation record not found. Run validation first.");
    }

    if (validation.launch_blocked || validation.verdict === "pivot") {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Cannot select a path while verdict is Pivot Required. Edit inputs and re-validate.",
      );
    }

    if (validation.verdict === "adjust" && params.selectedPath === "current" && !params.confirmAdjusted) {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Verdict is Adjust — confirm the adjusted path or select adjusted explicitly.",
      );
    }

    const intel = validation.intelligence_payload as ValidationIntelligencePayload | null;
    let blueprintContract = validation.blueprint_contract as Record<string, unknown> | null;

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

    logger.info({ blueprintId: params.blueprintId, selectedPath: params.selectedPath }, "[ValidationService] Path selected");
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
      .where(eq(validations.blueprint_id, params.blueprintId))
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

  async assertLaunchAllowed(blueprintId: string, userId: string): Promise<void> {
    const [row] = await db
      .select()
      .from(validations)
      .where(eq(validations.blueprint_id, blueprintId))
      .orderBy(desc(validations.created_at))
      .limit(1);

    if (!row) {
      throw new TorgimaError("VALIDATION_ERROR", "Validation must complete before blueprint launch.");
    }
    if (row.user_id !== userId) throw new TorgimaError("FORBIDDEN", "Not your validation");

    if (row.launch_blocked || row.verdict === "pivot") {
      throw new TorgimaError(
        "VALIDATION_ERROR",
        "Blueprint launch blocked: Pivot Required. Address critical issues and re-validate.",
      );
    }

    if (!row.selected_path) {
      throw new TorgimaError("VALIDATION_ERROR", "Select a validation path before launching.");
    }

    if (row.verdict === "adjust" && row.selected_path === "current" && !row.adjusted_path_confirmed) {
      throw new TorgimaError("VALIDATION_ERROR", "Confirm adjusted path before launch.");
    }

    const critical = ((row.intelligence_payload as ValidationIntelligencePayload | null)?.pis?.risk_flags ?? []).filter(
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
