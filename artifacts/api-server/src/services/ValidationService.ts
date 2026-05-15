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
import type {
  ValidationResult,
  OnboardingGoalInput,
  StructuredGoalDraft,
} from "../types/validation.js";

async function getAiEnabled(): Promise<boolean> {
  const rows = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1);
  return rows[0]?.enabled ?? false;
}

export const ValidationService = {
  // ── STRUCTURE GOAL ───────────────────────────────────────────────────────

  async structureGoal(params: {
    userId:    string;
    input:     OnboardingGoalInput;
    aiEnabled?: boolean;
  }): Promise<StructuredGoalDraft> {
    const aiEnabled = params.aiEnabled ?? (await getAiEnabled());
    if (aiEnabled) {
      return structureGoalWithBhudhi({ ...params.input, userId: params.userId });
    }
    return structureGoalDeterministic(params.input);
  },

  // ── VALIDATE GOAL ────────────────────────────────────────────────────────

  async validateGoal(params: {
    blueprintId: string;
    userId:      string;
    input: {
      goal:             string;
      purpose?:         string;
      timeframe?:       string;
      commitmentLevel?: string;
      currentContext?:  string;
      successSignal?:   string;
      knownBlockers?:   string;
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
      userId:      params.userId,
      input:       params.input,
      aiEnabled,
    });
  },

  // ── SELECT VALIDATION PATH ───────────────────────────────────────────────

  async selectValidationPath(params: {
    blueprintId:  string;
    userId:       string;
    selectedPath: "current" | "adjusted" | "alternative";
  }): Promise<{ selected: boolean }> {
    const bpRows = await db
      .select({ id: blueprints.id, status: blueprints.status })
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);

    const bp = bpRows[0];
    if (!bp) throw new TorgimaError("NOT_FOUND", "Blueprint not found");

    // Accept path_selection OR draft (if validation ran but status not updated yet)
    if (
      bp.status !== "path_selection" &&
      bp.status !== "awaiting_selection" &&
      bp.status !== "draft"
    ) {
      throw new TorgimaError(
        "STALE_STATE",
        `Blueprint is not in path selection state (current: ${bp.status})`,
      );
    }

    const validationRows = await db
      .select({ id: validations.id })
      .from(validations)
      .where(eq(validations.blueprint_id, params.blueprintId))
      .orderBy(desc(validations.created_at))
      .limit(1);

    const validation = validationRows[0];
    if (!validation) {
      throw new TorgimaError("NOT_FOUND", "Validation record not found. Run validation first.");
    }

    await db
      .update(validations)
      .set({
        selected_path: params.selectedPath as "current" | "adjusted" | "alternative",
        selected_at:   new Date(),
      })
      .where(eq(validations.id, validation.id));

    logger.info(
      { blueprintId: params.blueprintId, selectedPath: params.selectedPath },
      "[ValidationService] Path selected",
    );

    return { selected: true };
  },

  // ── GET VALIDATION RESULT ────────────────────────────────────────────────

  async getValidationResult(params: {
    blueprintId: string;
    userId:      string;
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

    const c = row.clarity_score ?? 0;
    const f = row.feasibility_score ?? 0;
    const r = row.realism_score ?? 0;
    const overall = Math.round((c + f + r) / 3);

    return {
      validationId: row.id,
      blueprintId:  params.blueprintId,
      verdict:      (row.verdict ?? "adjust") as "proceed" | "adjust" | "pivot",
      scores: {
        clarity:     { score: c, verdict: scoreToVerdict(c), finding: "" },
        feasibility: { score: f, verdict: scoreToVerdict(f), finding: "" },
        realism:     { score: r, verdict: scoreToVerdict(r), finding: "" },
        usefulness:  { score: 0, verdict: "acceptable", finding: "" },
        overall,
      },
      paths: {
        current:     (row.path_current     as unknown as import("../types/validation.js").ValidationPath) ?? null!,
        adjusted:    (row.path_adjusted    as unknown as import("../types/validation.js").ValidationPath) ?? null!,
        alternative: (row.path_alternative as unknown as import("../types/validation.js").ValidationPath) ?? null!,
      },
      usedFallback: false,
      aiSummary:    row.ai_summary ?? undefined,
      createdAt:    row.created_at,
    };
  },

  // ── LEGACY COMPAT — used by old route ────────────────────────────────────

  async validate(rawGoal: string, domain: string | null): Promise<{
    valid: boolean; score: number; feedback: string;
    suggestedDomain: string | null; refinedGoal: string | null; issues: string[];
  }> {
    const { scoreGoal, determineVerdict } = await import("../engines/validation/ValidationEngine.js");
    const scores  = scoreGoal({ goal: rawGoal });
    const verdict = determineVerdict(scores);
    return {
      valid:           verdict !== "pivot",
      score:           scores.overall,
      feedback:        scores.clarity.finding,
      suggestedDomain: domain,
      refinedGoal:     null,
      issues:          [
        ...(scores.clarity.suggestion ? [scores.clarity.suggestion] : []),
        ...(scores.feasibility.suggestion ? [scores.feasibility.suggestion] : []),
      ],
    };
  },
};
