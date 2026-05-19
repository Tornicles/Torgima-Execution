import { db } from "@workspace/db";
import { validations, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../../lib/logger.js";
import { TorgimaError } from "../../../lib/errors.js";
import { validatePayload } from "../../../lib/validationPayloadSchemas.js";
import type { BlueprintTier } from "../../blueprint/infrastructure/blueprint-types.js";
import { parseMode, parseTier } from "../../blueprint/BlueprintRuleEngine.js";
import { scoreGoal } from "../ValidationEngine.js";
import type { ValidationScores } from "../../../types/validation.js";
import { classifyIndustry } from "./IndustryClassifier.js";
import { buildCISContext } from "./CISService.js";
import { refineGoalWithIIS, isGoalMeasurable } from "./IISService.js";
import { fetchEISIntelligence, buildIndustryIntelligencePanel } from "./EISService.js";
import { calculateFeasibility } from "./FeasibilityCalculator.js";
import { generateStrategicPaths } from "./SISService.js";
import { runPIS } from "./PISService.js";
import { buildRiskMap } from "./RiskMapBuilder.js";
import { determineIntelligenceVerdict } from "./VerdictEngine.js";
import { buildValidationTabs } from "./buildValidationTabs.js";
import { buildValidationToBlueprintContract } from "./ValidationToBlueprintBridge.js";
import { applyTierDepthToResult } from "./applyTierDepth.js";
import type { FullValidationResult, ReadinessState, ValidationIntelligencePayload } from "./validation-intelligence-types.js";
import { ValidationKind, ValidationStatus } from "@workspace/state-machine";

export async function runFullValidation(params: {
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
}): Promise<FullValidationResult> {
  const [bp] = await db
    .select({ tier: blueprints.tier, mode: blueprints.mode })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const tier = params.tier ?? parseTier(bp?.tier);
  const mode = params.mode ?? parseMode(bp?.mode);

  const systemsProgress: ValidationIntelligencePayload["systemsProgress"] = {
    CIS: "running",
    IIS: "pending",
    EIS: "pending",
    SIS: "pending",
    PIS: "pending",
  };

  const classification = classifyIndustry({
    goal: params.input.goal,
    purpose: params.input.purpose,
    domainHint: params.input.domainHint,
  });
  const cis = buildCISContext({
    blueprintId: params.blueprintId,
    userId: params.userId,
    classification,
    tier,
    mode,
    commitmentLevel: params.input.commitmentLevel,
    currentContext: params.input.currentContext,
  });
  systemsProgress.CIS = "complete";
  systemsProgress.IIS = "running";

  const iis = await refineGoalWithIIS({
    userId: params.userId,
    aiEnabled: params.aiEnabled,
    input: {
      rawGoal: params.input.goal,
      purpose: params.input.purpose,
      timeframe: params.input.timeframe,
      commitmentLevel: params.input.commitmentLevel,
      currentContext: params.input.currentContext,
      successSignal: params.input.successSignal,
      knownBlockers: params.input.knownBlockers,
    },
  });
  systemsProgress.IIS = "complete";
  systemsProgress.EIS = "running";

  const eis = await fetchEISIntelligence({
    goal: iis.cleanedGoal,
    purpose: iis.purpose,
    timeframe: iis.timeframe,
    classification,
    cis,
    userId: params.userId,
    blueprintId: params.blueprintId,
    aiEnabled: params.aiEnabled,
  });
  systemsProgress.EIS = "complete";

  const feasibility = calculateFeasibility({
    goal: iis.cleanedGoal,
    timeframe: iis.timeframe,
    commitmentLevel: iis.commitmentLevel,
    eis,
    tier,
  });

  const scores: ValidationScores = scoreGoal({
    goal: iis.cleanedGoal,
    purpose: iis.purpose,
    timeframe: iis.timeframe,
    commitmentLevel: iis.commitmentLevel,
    currentContext: params.input.currentContext,
    successSignal: params.input.successSignal,
    knownBlockers: params.input.knownBlockers,
  });
  scores.feasibility.score = feasibility.score;
  scores.feasibility.verdict =
    feasibility.score >= 70 ? "strong" : feasibility.score >= 50 ? "acceptable" : feasibility.score >= 30 ? "weak" : "critical";

  systemsProgress.SIS = "running";
  const preliminaryVerdict = determineIntelligenceVerdict({
    eis,
    feasibility,
    risks: [],
    goal: iis.cleanedGoal,
    tier,
    goalMeasurable: isGoalMeasurable(iis.cleanedGoal),
  }).verdict;

  const paths = await generateStrategicPaths({
    blueprintId: params.blueprintId,
    userId: params.userId,
    goal: iis.cleanedGoal,
    purpose: iis.purpose,
    timeframe: iis.timeframe,
    commitmentLevel: iis.commitmentLevel,
    scores,
    verdict: preliminaryVerdict,
    eis,
    feasibility,
    iis,
    tier,
    aiEnabled: params.aiEnabled,
  });
  systemsProgress.SIS = "complete";
  systemsProgress.PIS = "running";

  const pis = runPIS({ goal: iis.cleanedGoal, eis, feasibility, tier });
  const risks = buildRiskMap({ eis, feasibility, pis });
  systemsProgress.PIS = "complete";

  const { verdict, reasoning, launchBlocked } = determineIntelligenceVerdict({
    eis,
    feasibility,
    risks,
    goal: iis.cleanedGoal,
    tier,
    goalMeasurable: isGoalMeasurable(iis.cleanedGoal),
  });

  const industryPanel = buildIndustryIntelligencePanel(eis, iis.cleanedGoal);
  const tabs = buildValidationTabs({ classification, eis, feasibility, goal: iis.cleanedGoal });

  const readiness: ReadinessState =
    launchBlocked || verdict === "pivot" ? "blocked_pivot"
    : verdict === "adjust" ? "ready_with_adjustment"
    : "ready_proceed";

  const intelligence: ValidationIntelligencePayload = {
    cis,
    iis,
    eis,
    industryPanel,
    tabs,
    paths,
    feasibility,
    pis,
    verdict,
    verdictReasoning: reasoning,
    readiness,
    launchBlocked,
    tier,
    systemsProgress,
  };

  const blueprintContract = buildValidationToBlueprintContract({
    intelligence,
    selectedPath: verdict === "adjust" ? "adjusted" : "current",
    paths,
    tier,
  });

  const aiSummary = buildSummary(verdict, reasoning, scores.overall);
  const usedFallback = !params.aiEnabled || eis.source === "EIS+fallback";

  const payloadCheck = validatePayload(ValidationKind.INTELLIGENCE, intelligence);
  if (!payloadCheck.success) {
    throw new TorgimaError(
      "VALIDATION_PAYLOAD_CORRUPT",
      `Intelligence payload failed schema check: ${payloadCheck.error.message}`,
    );
  }

  const existing = await db
    .select({ id: validations.id })
    .from(validations)
    .where(
      and(
        eq(validations.blueprint_id, params.blueprintId),
        eq(validations.validation_kind, "intelligence"),
      ),
    )
    .limit(1);

  const payload = {
    verdict: verdict as "proceed" | "adjust" | "pivot",
    feasibility_score: feasibility.score,
    clarity_score: scores.clarity.score,
    realism_score: scores.realism.score,
    ai_summary: aiSummary,
    path_current: paths.current as unknown as Record<string, unknown>,
    path_adjusted: paths.adjusted as unknown as Record<string, unknown>,
    path_alternative: paths.alternative as unknown as Record<string, unknown>,
    status: ValidationStatus.COMPLETE,
    validation_kind: ValidationKind.INTELLIGENCE,
    payload_version: 1,
    tier,
    intelligence_payload: intelligence as unknown as Record<string, unknown>,
    blueprint_contract: blueprintContract as unknown as Record<string, unknown>,
    launch_blocked: launchBlocked,
    readiness,
  };

  let validationId: string;
  let validationContractId: string;
  if (existing[0]) {
    validationId = existing[0].id;
    const [updated] = await db
      .update(validations)
      .set(payload)
      .where(eq(validations.id, validationId))
      .returning({ contract_id: validations.contract_id });
    if (!updated) throw new TorgimaError("INTERNAL_ERROR", "Failed to update validation");
    validationContractId = updated.contract_id;
  } else {
    const [inserted] = await db
      .insert(validations)
      .values({
        blueprint_id: params.blueprintId,
        user_id: params.userId,
        ...payload,
      })
      .returning({ id: validations.id, contract_id: validations.contract_id });
    if (!inserted) throw new TorgimaError("INTERNAL_ERROR", "Failed to create validation");
    validationId = inserted.id;
    validationContractId = inserted.contract_id;
  }

  const bpRow = await db
    .select({ selection_confirmed_at: blueprints.selection_confirmed_at, tier: blueprints.tier })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1)
    .then((r) => r[0]);

  const nextStatus =
    bpRow?.selection_confirmed_at && bpRow?.tier ? "path_selection" : "awaiting_selection";

  await db
    .update(blueprints)
    .set({ validation_id: validationId, status: nextStatus })
    .where(eq(blueprints.id, params.blueprintId));

  logger.info({ blueprintId: params.blueprintId, verdict, launchBlocked, tier }, "[ValidationOrchestrator] complete");

  const rowsAfter = await db
    .select({ created_at: validations.created_at })
    .from(validations)
    .where(eq(validations.id, validationId))
    .limit(1);

  const full: FullValidationResult = {
    validationId,
    validationContractId,
    blueprintId: params.blueprintId,
    verdict,
    scores,
    paths,
    intelligence,
    blueprintContract,
    usedFallback,
    aiSummary,
    launchBlocked,
    readiness,
    createdAt: rowsAfter[0]?.created_at ?? new Date(),
  };

  return applyTierDepthToResult(full, tier);
}

function buildSummary(verdict: string, reasoning: string, overall: number): string {
  const map = {
    proceed: "Proceed — your direction is validated.",
    adjust: "Adjust — review the improved path before launch.",
    pivot: "Pivot required — blueprint launch is blocked until direction changes.",
  } as const;
  return `${map[verdict as keyof typeof map] ?? ""} Score ${overall}/100. ${reasoning}`;
}
