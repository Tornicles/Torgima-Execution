import { db, validationPaths, validations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { getFallback } from "../../bhudhi/FallbackLibrary.js";
import type { ValidationRunInput } from "./ValidationResearchEngine.js";

type PathType = "current" | "adjusted" | "alternative";

const PATH_DEFAULTS: Record<
  PathType,
  {
    success_potential: string;
    estimated_outcome: string;
    time_to_traction: string;
    description: string;
  }
> = {
  current: {
    success_potential: "medium",
    estimated_outcome: "Steady progress with full-scope risk",
    time_to_traction: "6–12 months",
    description: "Execute the idea as stated with current assumptions and full scope.",
  },
  adjusted: {
    success_potential: "high",
    estimated_outcome: "Faster traction with narrowed proof",
    time_to_traction: "3–6 months",
    description: "Keep the core goal but narrow scope, increase proof cadence, and de-risk launch.",
  },
  alternative: {
    success_potential: "high",
    estimated_outcome: "Higher ceiling after pivot",
    time_to_traction: "9–18 months",
    description: "Pivot the wedge or business model before scaling spend.",
  },
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizePath(
  pathType: PathType,
  raw: Record<string, unknown> | null,
): Record<string, unknown> {
  const def = PATH_DEFAULTS[pathType];
  const success = String(raw?.success_potential ?? raw?.successPotential ?? def.success_potential);
  const traction = String(raw?.time_to_traction ?? raw?.timeToTraction ?? def.time_to_traction);
  const outcome = String(
    raw?.estimated_outcome ?? raw?.estimatedOutcome ?? raw?.growth_potential ?? def.estimated_outcome,
  );
  const description = String(raw?.description ?? raw?.summary ?? def.description);

  return {
    pathType,
    type: pathType,
    label:
      pathType === "adjusted"
        ? "Adjusted Path (Best Fit)"
        : pathType === "alternative"
          ? "Alternative Path (Pivot)"
          : "Current Path (As Is)",
    description,
    summary: description,
    success_potential: success,
    successPotential: success,
    estimated_outcome: outcome,
    estimatedOutcome: outcome,
    growth_potential: outcome,
    time_to_traction: traction,
    timeToTraction: traction,
    recommended: pathType === "adjusted",
  };
}

function fallbackPaths(input: ValidationRunInput): Record<PathType, Record<string, unknown>> {
  const fb = getFallback("fallback.validation_paths", {
    goal: input.goal,
    idea_title: input.idea_title,
  }, 0);
  const data = (fb?.data ?? {}) as Record<string, unknown>;
  const paths = asRecord(data.paths) ?? data;
  return {
    current: normalizePath("current", asRecord(paths.current) ?? paths),
    adjusted: normalizePath("adjusted", asRecord(paths.adjusted) ?? paths),
    alternative: normalizePath("alternative", asRecord(paths.alternative) ?? paths),
  };
}

export async function buildValidationPathsViaBhudhi(
  runId: string,
  legacyValidationId: string,
  input: ValidationRunInput,
): Promise<Record<PathType, Record<string, unknown>>> {
  const [row] = await db
    .select({
      verdict: validations.verdict,
      reality_score: validations.reality_score,
      market_score: validations.market_score,
      competition_score: validations.competition_score,
    })
    .from(validations)
    .where(eq(validations.id, legacyValidationId))
    .limit(1);

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "ValidationResearchEngine",
      triggerType: "VALIDATION_BUILD_PATHS",
      userId: input.user_id,
      blueprintId: input.blueprint_draft_id,
      stateVersion: 0,
      idempotencyKey: `validation_build_paths:${runId}`,
      facts: {
        goal: input.goal,
        purpose: input.purpose,
        idea_title: input.idea_title,
        timeframe: input.timeframe,
        verdict: row?.verdict ?? "adjust",
        reality_score: row?.reality_score,
        market_score: row?.market_score,
        competition_score: row?.competition_score,
      },
      webSearchEnabled: false,
    });

    if (result.ok && result.output?.data && typeof result.output.data === "object") {
      const data = result.output.data as Record<string, unknown>;
      const pathsRoot = asRecord(data.paths) ?? data;
      const built = {
        current: normalizePath("current", asRecord(pathsRoot.current)),
        adjusted: normalizePath("adjusted", asRecord(pathsRoot.adjusted)),
        alternative: normalizePath("alternative", asRecord(pathsRoot.alternative)),
      };

      await db.delete(validationPaths).where(eq(validationPaths.validation_run_id, runId));
      for (const pathType of ["current", "adjusted", "alternative"] as const) {
        const p = built[pathType];
        await db.insert(validationPaths).values({
          validation_run_id: runId,
          path_type: pathType,
          label: String(p.label ?? pathType),
          is_recommended: pathType === "adjusted",
          description: String(p.description ?? ""),
          tagline: String(p.tagline ?? ""),
          success_potential: String(p.success_potential ?? "medium"),
          estimated_outcome: String(p.estimated_outcome ?? ""),
          time_to_traction: String(p.time_to_traction ?? "—"),
          key_adjustments: [],
          milestones: [],
          path_specific_risks: [],
          path_rationale: "Bhudhi VALIDATION_BUILD_PATHS",
        });
      }
      return built;
    }
  } catch {
    /* use deterministic fallback */
  }

  const built = fallbackPaths(input);
  await db.delete(validationPaths).where(eq(validationPaths.validation_run_id, runId));
  for (const pathType of ["current", "adjusted", "alternative"] as const) {
    const p = built[pathType];
    await db.insert(validationPaths).values({
      validation_run_id: runId,
      path_type: pathType,
      label: String(p.label ?? pathType),
      is_recommended: pathType === "adjusted",
      description: String(p.description ?? ""),
      tagline: "",
      success_potential: String(p.success_potential ?? "medium"),
      estimated_outcome: String(p.estimated_outcome ?? ""),
      time_to_traction: String(p.time_to_traction ?? "—"),
      key_adjustments: [],
      milestones: [],
      path_specific_risks: [],
      path_rationale: "Deterministic path differentiation",
    });
  }
  return built;
}
