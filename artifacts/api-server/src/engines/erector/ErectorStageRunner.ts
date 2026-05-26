/**
 * 20-stage Erector validation pipeline — TORGIMA_ERECTOR_COMPLETE_SYSTEM.docx §F
 */
import { db, validations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveArchetype } from "./ArchetypeResolutionEngine.js";
import { callErectorTrigger } from "./ErectorIntelligenceBridge.js";
import { ensureErectorCompletePromptsRegistered } from "../../bhudhi/registerErectorCompletePrompts.js";
import { stageDeterministicFallbacks, searchPreamble } from "./erectorStageDeterministic.js";
import type { HandoffPackage, ValidationFeedInput } from "../../types/erector-complete.js";
import type { BhudhiTriggerType } from "../../types/bhudhi.js";
import { ErectorValidationStage, ValidationKind, ValidationStatus } from "@workspace/state-machine";
import { writeEvent, EventTypes } from "../../services/EventService.js";
import { logger } from "../../lib/logger.js";
import type { ErectorValidationInput } from "../../types/erector.js";

const STAGE_TRIGGER: Record<string, BhudhiTriggerType> = {
  stage_2_decomposition: "VALIDATE_STAGE_2_DECOMPOSITION",
  stage_3_economic: "VALIDATE_STAGE_3_ECONOMIC",
  stage_4_patterns: "VALIDATE_STAGE_4_PATTERNS",
  stage_5_timing: "VALIDATE_STAGE_5_TIMING",
  stage_6_market: "VALIDATE_STAGE_6_MARKET",
  stage_7_channels: "VALIDATE_STAGE_7_CHANNELS",
  stage_8_pros: "VALIDATE_STAGE_8_PROS",
  stage_9_cons: "VALIDATE_STAGE_9_CONS",
  stage_10_feasibility: "VALIDATE_STAGE_10_FEASIBILITY",
  stage_11_viability: "VALIDATE_STAGE_11_VIABILITY",
  stage_12_bootstrap: "VALIDATE_STAGE_12_BOOTSTRAP",
  stage_13_features: "VALIDATE_STAGE_13_FEATURES",
  stage_14_customer: "VALIDATE_STAGE_14_CUSTOMER",
  stage_15_positioning: "VALIDATE_STAGE_15_POSITIONING",
  stage_16_difficulty: "VALIDATE_STAGE_16_DIFFICULTY",
  stage_17_revenue: "VALIDATE_STAGE_17_REVENUE",
  stage_18_90days: "VALIDATE_STAGE_18_90DAYS",
  stage_19_paths: "VALIDATE_STAGE_19_PATHS",
  stage_20_decision: "VALIDATE_STAGE_20_DECISION",
};

const STAGE_COLUMN: Record<string, keyof typeof validations.$inferInsert> = {
  stage_2_decomposition: "stage_purpose_decomposition",
  stage_3_economic: "stage_economic_resolution",
  stage_4_patterns: "stage_business_patterns",
  stage_5_timing: "stage_economy_timing",
  stage_6_market: "stage_market_analysis",
  stage_7_channels: "stage_social_channels",
  stage_8_pros: "stage_pros",
  stage_9_cons: "stage_cons",
  stage_10_feasibility: "stage_feasibility",
  stage_11_viability: "stage_viability",
  stage_12_bootstrap: "stage_bootstrap",
  stage_13_features: "stage_features",
  stage_14_customer: "stage_customer_definition",
  stage_15_positioning: "stage_positioning",
  stage_16_difficulty: "stage_difficulty",
  stage_17_revenue: "stage_revenue_path",
  stage_18_90days: "stage_first_90_days",
  stage_19_paths: "stage_execution_paths",
  stage_20_decision: "stage_final_decision",
};

const STAGES_ORDER = Object.keys(STAGE_TRIGGER);

function feedToErectorInput(feed: ValidationFeedInput, archetypeName: string): ErectorValidationInput {
  return {
    userId: feed.userId,
    blueprintId: feed.blueprintId,
    idempotencyKey: feed.idempotencyKey,
    rawGoal: feed.goal_final,
    goalFinal: feed.goal_final,
    purpose: feed.purpose_final,
    purposeFinal: feed.purpose_final,
    timeframe: feed.timeframe_end && feed.timeframe_start ? "custom" : "90d",
    commitmentLevel: feed.commitment_level,
    desiredOutcome: feed.purpose_final,
    location: { country: feed.country, city: feed.location_city },
    businessType: "online",
    businessModel: feed.business_model,
    budgetAvailable: feed.budget,
    currency: feed.currency ?? "USD",
    currentResources: feed.resources,
    targetCustomer: feed.target_customer,
    tier: feed.tier,
  };
}

async function runStage(
  stageKey: string,
  feed: ValidationFeedInput,
  validationId: string,
  archetypeResolution: Awaited<ReturnType<typeof resolveArchetype>>,
): Promise<unknown> {
  if (stageKey === "stage_1_intake") {
    const missing: string[] = [];
    if (!feed.goal_final) missing.push("goal_final");
    if (!feed.purpose_final) missing.push("purpose_final");
    if (!feed.country) missing.push("country");
    if (!feed.business_type) missing.push("business_type");
    if (!feed.target_customer) missing.push("target_customer");
    return { valid: missing.length === 0, missing };
  }

  const trigger = STAGE_TRIGGER[stageKey];
  const fallbackFn = stageDeterministicFallbacks[stageKey];
  const input = feedToErectorInput(feed, archetypeResolution.primaryArchetype.name);

  if (trigger) {
    try {
      const extra =
        stageKey === "stage_4_patterns" ||
        stageKey === "stage_5_timing" ||
        stageKey === "stage_6_market" ||
        stageKey === "stage_7_channels"
          ? { searchPreamble: searchPreamble(feed) }
          : {};
      const { data } = await callErectorTrigger(trigger, {
        input,
        archetype: archetypeResolution,
        validationId,
        extraFacts: extra,
      });
      if (data && Object.keys(data).length > 0) return data;
    } catch (err) {
      logger.warn({ stageKey, err }, "[ErectorStageRunner] Bhudhi stage failed — fallback");
    }
  }

  return fallbackFn ? fallbackFn(feed) : {};
}

export async function runErectorTwentyStages(feed: ValidationFeedInput): Promise<{ validationId: string }> {
  ensureErectorCompletePromptsRegistered();

  const archetypeResolution = await resolveArchetype(feed.country, feed.location_city);
  const economicType = feed.economic_type ?? archetypeResolution.primaryArchetype.name;

  const [existing] = await db
    .select()
    .from(validations)
    .where(eq(validations.idempotency_key, feed.idempotencyKey))
    .limit(1);

  const baseValues = {
    blueprint_id: feed.blueprintId,
    user_id: feed.userId,
    idempotency_key: feed.idempotencyKey,
    validation_kind: ValidationKind.ERECTOR,
    status: ValidationStatus.RUNNING,
    validation_stage: ValidationStatus.RUNNING,
    erector_validation_stage: ErectorValidationStage.RUNNING,
    goal_final: feed.goal_final,
    purpose_final: feed.purpose_final,
    country: feed.country,
    location_country: feed.country,
    economic_type: economicType,
    business_type: feed.business_type,
    business_model: feed.business_model,
    commitment_level: feed.commitment_level,
    budget_available: feed.budget,
    currency: feed.currency ?? "USD",
    current_resources: feed.resources,
    target_customer: feed.target_customer,
    timeframe_start: feed.timeframe_start ? new Date(feed.timeframe_start) : null,
    timeframe_end: feed.timeframe_end ? new Date(feed.timeframe_end) : null,
    archetype_resolution: archetypeResolution,
    validation_feed: feed,
  };

  const [row] = existing
    ? await db.update(validations).set(baseValues).where(eq(validations.id, existing.id)).returning()
    : await db.insert(validations).values(baseValues).returning();

  if (!row) throw new Error("Could not create validation for 20-stage run");

  await writeEvent({
    eventType: EventTypes.ERECTOR_VALIDATION_STARTED,
    entityType: "validation",
    entityId: row.id,
    userId: feed.userId,
    blueprintId: feed.blueprintId,
    payload: { validationId: row.id, pipeline: "20_stage" },
    idempotencyKey: `erector_20_stage_started:${row.id}`,
  }).catch(() => null);

  const patch: Record<string, unknown> = {};

  for (const stageKey of ["stage_1_intake", ...STAGES_ORDER]) {
    try {
      const result = await runStage(stageKey, { ...feed, economic_type: economicType }, row.id, archetypeResolution);
      const col = STAGE_COLUMN[stageKey];
      if (col) {
        if (stageKey === "stage_20_decision" && typeof result === "object" && result && "decision" in result) {
          patch[col] = String((result as { decision: string }).decision);
        } else {
          patch[col] = result;
        }
      }
      logger.info({ validationId: row.id, stageKey }, "[Erector] stage complete");
    } catch (err) {
      logger.error({ stageKey, err }, "[Erector] stage failed — continuing");
      const col = STAGE_COLUMN[stageKey];
      if (col && stageDeterministicFallbacks[stageKey]) {
        patch[col] = stageDeterministicFallbacks[stageKey]({ ...feed, economic_type: economicType });
      }
    }
  }

  const paths = (patch.stage_execution_paths ?? {}) as {
    foundation?: Record<string, unknown>;
    momentum?: Record<string, unknown>;
    overdrive?: Record<string, unknown>;
  };
  const decision =
    typeof patch.stage_final_decision === "string"
      ? patch.stage_final_decision
      : ((patch.stage_final_decision as { decision?: string })?.decision ?? "adjust");

  const verdict =
    decision === "proceed" ? "proceed" : decision === "pivot" ? "pivot" : decision === "delay" ? "adjust" : "adjust";

  await db
    .update(validations)
    .set({
      ...patch,
      path_foundation: paths.foundation ?? null,
      path_momentum: paths.momentum ?? null,
      path_overdrive: paths.overdrive ?? null,
      path_current: paths.momentum ?? paths.foundation,
      path_adjusted: paths.foundation ?? null,
      path_alternative: paths.overdrive ?? null,
      purpose_decomposition: patch.stage_purpose_decomposition,
      market_analysis: patch.stage_market_analysis,
      competitor_analysis: patch.stage_business_patterns,
      economy_briefing: patch.stage_economic_resolution,
      timing_analysis: patch.stage_economy_timing,
      customer_pain_analysis: patch.stage_customer_definition,
      execution_difficulty: patch.stage_difficulty,
      industry_pros: patch.stage_pros,
      industry_cons: patch.stage_cons,
      verdict,
      validation_stage: ValidationStatus.COMPLETE,
      erector_validation_stage: ErectorValidationStage.COMPLETE,
      status: ValidationStatus.COMPLETE,
      reality_score: decision === "proceed" ? 72 : decision === "adjust" ? 58 : 42,
      validation_sections: buildWorkspaceCards(patch),
      validation_original_snapshot: patch,
      validation_workspace_version: 1,
    })
    .where(eq(validations.id, row.id));

  await writeEvent({
    eventType: EventTypes.ERECTOR_VALIDATION_COMPLETED,
    entityType: "validation",
    entityId: row.id,
    userId: feed.userId,
    blueprintId: feed.blueprintId,
    payload: { validationId: row.id, pipeline: "20_stage", verdict: decision },
    idempotencyKey: `erector_20_stage_complete:${row.id}`,
  }).catch(() => null);

  return { validationId: row.id };
}

function buildWorkspaceCards(patch: Record<string, unknown>) {
  const titles: Array<[string, string, number]> = [
    ["intake_confirmation", "Intake Confirmation", 1],
    ["stage_purpose_decomposition", "Purpose Decomposition", 2],
    ["stage_economic_resolution", "Economic Type", 3],
    ["stage_business_patterns", "Business Patterns", 4],
    ["stage_economy_timing", "Economy + Timing", 5],
    ["stage_market_analysis", "Market Analysis", 6],
    ["stage_social_channels", "Social & Channels", 7],
    ["stage_pros", "Pros", 8],
    ["stage_cons", "Cons", 9],
    ["stage_feasibility", "Feasibility", 10],
    ["stage_viability", "Viability", 11],
    ["stage_bootstrap", "Bootstrap Summary", 12],
    ["stage_features", "Feature Recommendation", 13],
    ["stage_customer_definition", "Customer Definition", 14],
    ["stage_positioning", "Positioning", 15],
    ["stage_difficulty", "Difficulty Breakdown", 16],
    ["stage_revenue_path", "Revenue Path", 17],
    ["stage_first_90_days", "First 90 Days", 18],
    ["stage_execution_paths", "Execution Paths", 19],
    ["stage_final_decision", "Final Decision", 20],
  ];
  return titles.map(([key, title, stage]) => ({
    id: key.replace("stage_", "").replace(/_/g, "_"),
    title,
    sequenceStage: stage,
    content: (patch[key] as Record<string, unknown>) ?? {},
    lastUpdatedAt: new Date().toISOString(),
  }));
}

export function assembleHandoffPackage(row: typeof validations.$inferSelect): HandoffPackage {
  const paths = (row.stage_execution_paths ?? {}) as Record<string, Record<string, unknown>>;
  return {
    goal_final: row.goal_final ?? "",
    purpose_final: row.purpose_final ?? "",
    country: row.country ?? row.location_country ?? "",
    economic_type: row.economic_type ?? "",
    business_type: row.business_type ?? "",
    timeframe_start: row.timeframe_start?.toISOString(),
    timeframe_end: row.timeframe_end?.toISOString(),
    target_customer: row.target_customer ?? "",
    final_decision: row.stage_final_decision ?? row.verdict ?? "adjust",
    selected_path: (row.selected_execution_path as HandoffPackage["selected_path"]) ?? "momentum",
    bootstrap_summary: (row.stage_bootstrap as Record<string, unknown>) ?? {},
    feature_priority: (row.stage_features as Record<string, unknown>) ?? {},
    first_90_days: (row.stage_first_90_days as Record<string, unknown>) ?? {},
    positioning: (row.stage_positioning as Record<string, unknown>) ?? {},
    revenue_path: (row.stage_revenue_path as Record<string, unknown>) ?? {},
    risks: ((row.stage_cons as { cons?: unknown[] })?.cons ?? []) as unknown[],
    opportunities: ((row.stage_pros as { pros?: unknown[] })?.pros ?? []) as unknown[],
    customer_definition: (row.stage_customer_definition as Record<string, unknown>) ?? {},
  };
}
