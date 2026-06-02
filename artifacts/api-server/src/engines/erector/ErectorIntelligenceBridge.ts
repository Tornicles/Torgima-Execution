import { db, economicArchetypes } from "@workspace/db";
import { sql } from "drizzle-orm";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { getFallback } from "../../bhudhi/FallbackLibrary.js";
import { getContract } from "../../bhudhi/PromptRegistry.js";
import { ERECTOR_SEARCH_TRIGGERS } from "../../bhudhi/bhudhiProviders.js";
import type { BhudhiTriggerType } from "../../types/bhudhi.js";
import type { ArchetypeResolutionOutput, ErectorValidationInput } from "../../types/erector.js";
import { buildDeterministicErectorPayload } from "./ErectorDeterministicPayload.js";
import { emitErectorEngineCompleted } from "./emitErectorEvents.js";
import { seedEconomicArchetypes } from "./seedArchetypes.js";
import { logger } from "../../lib/logger.js";

function mergeRecord<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown> | null | undefined): T {
  if (!patch || typeof patch !== "object") return base;
  return { ...base, ...patch } as T;
}

function erectorFacts(
  input: ErectorValidationInput,
  archetype: ArchetypeResolutionOutput,
  validationId: string,
): Record<string, unknown> {
  const primary = archetype.primaryArchetype;
  const targetCustomer = input.targetCustomer || input.rawGoal;
  const currentContext =
    input.currentContext || `Building ${input.businessModel} in ${input.location.country}`;
  const budgetAvailable = input.budgetAvailable || 0;
  return {
    validationId,
    rawGoal: input.rawGoal,
    goal: input.goalFinal ?? input.rawGoal,
    goalFinal: input.goalFinal ?? input.rawGoal,
    purpose: input.purposeFinal ?? input.purpose,
    purposeFinal: input.purposeFinal ?? input.purpose,
    desiredOutcome: input.desiredOutcome,
    timeframe: input.timeframe,
    commitmentLevel: input.commitmentLevel,
    location: input.location,
    country: input.location.country,
    city: input.location.city,
    businessType: input.businessType,
    businessModel: input.businessModel,
    budgetAvailable,
    currency: input.currency,
    currentResources: input.currentResources,
    targetCustomer,
    currentContext,
    knownBlockers: input.knownBlockers ?? [],
    archetypeNumber: primary.archetypeNumber,
    archetypeName: primary.name,
    economyWarnings: archetype.economySpecificWarnings,
    economyOpportunities: archetype.economySpecificOpportunities,
    consumerBehaviorPatterns: primary.consumerBehaviorPatterns,
    typicalResistancePatterns: primary.typicalResistancePatterns,
    survivorBehaviorPatterns: primary.survivorBehaviorPatterns,
  };
}

export async function callErectorTrigger(
  triggerType: BhudhiTriggerType,
  params: {
    input: ErectorValidationInput;
    archetype: ArchetypeResolutionOutput;
    validationId: string;
    extraFacts?: Record<string, unknown>;
  },
): Promise<{ data: Record<string, unknown>; fallbackUsed: boolean }> {
  const contract = getContract(triggerType);
  const facts = { ...erectorFacts(params.input, params.archetype, params.validationId), ...params.extraFacts };
  const fallbackKey = contract?.fallbackKey ?? `fallback.${triggerType.toLowerCase()}`;

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "erector_validation",
      triggerType,
      userId: params.input.userId,
      blueprintId: params.input.blueprintId,
      stateVersion: 0,
      idempotencyKey: `erector:${triggerType}:${params.validationId}`,
      facts,
      webSearchEnabled: ERECTOR_SEARCH_TRIGGERS.has(triggerType),
    });
    if (result.ok && result.output?.data && typeof result.output.data === "object") {
      const out = { data: result.output.data as Record<string, unknown>, fallbackUsed: result.fallbackUsed };
      await emitErectorEngineCompleted({
        validationId: params.validationId,
        blueprintId: params.input.blueprintId,
        userId: params.input.userId,
        engineName: triggerType,
        success: true,
        fallbackUsed: result.fallbackUsed,
      });
      return out;
    }
  } catch (err) {
    logger.warn({ triggerType, err: err instanceof Error ? err.message : String(err) }, "[Erector] Bhudhi trigger failed");
  }

  const fb = getFallback(fallbackKey, facts, 0);
  const out = { data: (fb.data ?? {}) as Record<string, unknown>, fallbackUsed: true };
  await emitErectorEngineCompleted({
    validationId: params.validationId,
    blueprintId: params.input.blueprintId,
    userId: params.input.userId,
    engineName: triggerType,
    success: true,
    fallbackUsed: true,
  });
  return out;
}

export async function ensureEconomicArchetypesSeeded(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(economicArchetypes)
    .catch(() => [{ count: 0 }]);
  const count = row?.count ?? 0;
  if (count >= 30) return count;
  return seedEconomicArchetypes();
}

export interface ErectorEnrichedPayload {
  purposeDecomposition: Record<string, unknown>;
  industryIntelligence: Record<string, unknown>;
  marketAnalysis: Record<string, unknown>;
  competitorAnalysis: Record<string, unknown>;
  economyBriefing: Record<string, unknown>;
  customerPainAnalysis: Record<string, unknown>;
  executionDifficulty: Record<string, unknown>;
  timingAnalysis: Record<string, unknown>;
  bhudhiFallbackCount: number;
  bhudhiTriggerCount: number;
}

/** Run Bhudhi Erector triggers and merge with deterministic rule-engine baseline. */
export async function buildErectorOutputs(
  input: ErectorValidationInput,
  archetype: ArchetypeResolutionOutput,
  validationId: string,
): Promise<ErectorEnrichedPayload> {
  const base = buildDeterministicErectorPayload(input, archetype);
  let fallbackCount = 0;
  let triggerCount = 0;

  const narrative = await callErectorTrigger("ERECTOR_ARCHETYPE_NARRATIVE", { input, archetype, validationId });
  triggerCount++;
  if (narrative.fallbackUsed) fallbackCount++;

  const purpose = await callErectorTrigger("ERECTOR_PURPOSE_DECOMPOSE", { input, archetype, validationId });
  triggerCount++;
  if (purpose.fallbackUsed) fallbackCount++;

  const industry = await callErectorTrigger("ERECTOR_INDUSTRY_ANALYZE", { input, archetype, validationId });
  triggerCount++;
  if (industry.fallbackUsed) fallbackCount++;

  const market = await callErectorTrigger("ERECTOR_MARKET_ANALYZE", { input, archetype, validationId, extraFacts: { industry: industry.data } });
  triggerCount++;
  if (market.fallbackUsed) fallbackCount++;

  const competitors = await callErectorTrigger("ERECTOR_COMPETITORS_IDENTIFY", { input, archetype, validationId, extraFacts: { market: market.data } });
  triggerCount++;
  if (competitors.fallbackUsed) fallbackCount++;

  const economy = await callErectorTrigger("ERECTOR_ECONOMY_BRIEFING", { input, archetype, validationId, extraFacts: { narrative: narrative.data } });
  triggerCount++;
  if (economy.fallbackUsed) fallbackCount++;

  const pain = await callErectorTrigger("ERECTOR_PAIN_ANALYZE", { input, archetype, validationId });
  triggerCount++;
  if (pain.fallbackUsed) fallbackCount++;

  const briefingNarrative =
    String(economy.data["briefingNarrative"] ?? economy.data["summary"] ?? narrative.data["economyNarrative"] ?? "").trim() ||
    base.economyBriefing.briefingNarrative;

  return {
    purposeDecomposition: mergeRecord(base.purposeDecomposition, purpose.data),
    industryIntelligence: mergeRecord(base.industryIntelligence, {
      ...industry.data,
      industry_state_narrative:
        industry.data["industry_state_narrative"] ?? industry.data["summary"] ?? base.industryIntelligence.industry_state_narrative,
    }),
    marketAnalysis: mergeRecord(base.marketAnalysis, {
      ...market.data,
      opportunities: market.data["opportunities"] ?? [],
    }),
    competitorAnalysis: mergeRecord(
      base.competitorAnalysis,
      competitors.data["competitors"]
        ? competitors.data
        : { competitors: competitors.data["winners"] ?? base.competitorAnalysis.competitors },
    ),
    economyBriefing: mergeRecord(base.economyBriefing, {
      ...economy.data,
      briefingNarrative,
      economicContext: economy.data["economicContext"] ?? economy.data["economic_context"],
    }),
    customerPainAnalysis: mergeRecord(base.customerPainAnalysis, pain.data),
    executionDifficulty: base.executionDifficulty,
    timingAnalysis: mergeRecord(base.timingAnalysis, {
      ...industry.data,
      timingVerdict: industry.data["trendDirection"] ?? base.timingAnalysis.trendDirection,
      momentumScore: industry.data["momentumScore"] ?? base.timingAnalysis.momentumScore,
    }),
    bhudhiFallbackCount: fallbackCount,
    bhudhiTriggerCount: triggerCount,
  };
}
