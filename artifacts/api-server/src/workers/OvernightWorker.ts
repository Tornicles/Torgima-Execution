import { db, blueprints, morningReports, orders, blueprintInterpretations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getWorldModel, updateWorldModel } from "../engines/world-model/WorldModelEngine.js";
import { analyzeBlueprint, generateInterpretation } from "../bhudhi/agents/BlueprintAgent.js";
import { expireStaleProposals } from "../engines/governance/GovernanceService.js";
import {
  runDailyEvaluation,
  runWeeklyCalibration,
  writeStabilityPatternSummary,
} from "../bhudhi/agents/SelfImprovementAgent.js";
import { generateNextTask } from "../engines/execution-loop/generateNextTask.js";
import { enrichPackagesWithEIS } from "../bhudhi/agents/KnowledgeAgent.js";
import { ensureActiveOrder } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { scoreBurnoutRisk } from "../engines/burnout/BurnoutDetectionEngine.js";
import { runPatternAnalysis } from "../engines/pattern/PatternRecordsEngine.js";
import { updateCharacterScores } from "../engines/character/CharacterProgressionEngine.js";
import { checkAndGenerateRewards } from "../engines/reward/RewardSystemEngine.js";
import { runIdentityUpdateFromRecent } from "../bhudhi/agents/PsychologyAgent.js";
import { writeMemory } from "../bhudhi/MemoryService.js";
import { runFullNightlyResearch } from "../engines/eis/EISEngine.js";
import { idempotencyRecords } from "@workspace/db";
import { emitEvent, storeIdempotencyResult, EVENT_TYPES } from "../engines/event/EventSystem.js";

function isDayOfWeek(day: string): boolean {
  return (
    new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase() ===
    day.toLowerCase()
  );
}

function isStale(date: Date, hours: number): boolean {
  return Date.now() - date.getTime() > hours * 60 * 60 * 1000;
}

export type OvernightStepId =
  | "00_rate_limit"
  | "01_load_context"
  | "02_eis_research"
  | "03_knowledge_update"
  | "04_blueprint_health"
  | "05_interpretation_refresh"
  | "06_governance_expire"
  | "07_burnout"
  | "08_identity"
  | "09_pattern"
  | "09b_skill_gap"
  | "10_character"
  | "11_task_pregen"
  | "12_morning_report"
  | "13_memory"
  | "14_self_improvement"
  | "15_task_guarantee";

export async function runOvernightCycle(userId: string): Promise<{ reportId: string }> {
  const reportDate = new Date().toISOString().slice(0, 10);
  const overnightKey = `overnight_run:${userId}:${reportDate}`;

  const [priorRun] = await db
    .select()
    .from(idempotencyRecords)
    .where(eq(idempotencyRecords.key, overnightKey))
    .limit(1);

  if (priorRun?.result && (priorRun.result as { reportId?: string }).reportId) {
    return { reportId: String((priorRun.result as { reportId: string }).reportId) };
  }

  const steps: OvernightStepId[] = [];

  // STEP 00 — rate limit / idempotency gate
  steps.push("00_rate_limit");

  // STEP 01 — load user context
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);

  const world = await getWorldModel(userId);
  const stateVersion = world?.stateVersion ?? bp?.state_version ?? 0;
  const context = {
    userId,
    blueprintId: bp?.id,
    domain: bp?.domain_hint ?? bp?.current_domain,
    condition: bp?.current_condition,
  };
  steps.push("01_load_context");

  // STEP 02 — EIS full research
  let eisSection: Record<string, unknown> = { briefing: "EIS skipped — no active blueprint" };
  if (bp) {
    const briefing = await runFullNightlyResearch(userId, {
      userId,
      blueprintId: bp.id,
      domain: bp.domain_hint ?? bp.current_domain ?? "Content",
      niche: bp.role_context ?? "general",
      industry: bp.domain_hint ?? undefined,
      blueprintPhase: bp.status ?? "active",
    }).catch(() => null);

    if (briefing) {
      eisSection = {
        researchMethod: briefing.researchMethod,
        confidenceTier: briefing.confidenceTier,
        trendingTopics: briefing.trendingTopics,
        platformSignals: briefing.platformSignals,
        platformAlgorithmSignals: briefing.platformAlgorithmSignals,
        competitorInsights: briefing.competitorInsights,
        competitorIntelligence: briefing.competitorIntelligence,
        trendVelocity: briefing.trendVelocity,
        narrative: briefing.narrative,
        opportunities: briefing.opportunities,
        opportunityWindows: briefing.opportunityWindows,
        todayRecommendation: briefing.todayRecommendation,
        searchCount: briefing.searchLog.length,
        cacheUntil: briefing.cacheUntil,
      };
    }
  }
  steps.push("02_eis_research");

  // STEP 03 — knowledge library
  if (bp && eisSection.trendingTopics) {
    await enrichPackagesWithEIS(
      userId,
      bp.domain_hint ?? bp.current_domain ?? "delivery",
      eisSection,
    ).catch(() => null);
  }
  steps.push("03_knowledge_update");

  // STEP 04 — blueprint health (Sunday)
  if (bp && isDayOfWeek("sunday")) {
    await analyzeBlueprint({
      blueprintId: bp.id,
      userId,
      worldStateVersion: stateVersion,
      triggerReason: "OVERNIGHT",
    }).catch((err) => {
      logger.warn({ err }, "[OvernightWorker] Blueprint health check failed");
    });
  }
  steps.push("04_blueprint_health");

  // STEP 05 — interpretation refresh
  if (bp) {
    const [lastInterp] = await db
      .select()
      .from(blueprintInterpretations)
      .where(eq(blueprintInterpretations.blueprint_id, bp.id))
      .limit(1);

    if (
      !lastInterp ||
      isStale(lastInterp.generated_at, 24) ||
      lastInterp.world_state_version !== stateVersion
    ) {
      await generateInterpretation(bp.id, userId, { forceRefresh: true }).catch(() => null);
    }
  }
  steps.push("05_interpretation_refresh");

  // STEP 06 — governance
  await expireStaleProposals().catch(() => null);
  steps.push("06_governance_expire");

  // STEP 07 — burnout
  const burnout = await scoreBurnoutRisk(userId).catch(() => null);
  steps.push("07_burnout");

  // STEP 08 — identity
  await runIdentityUpdateFromRecent(userId).catch(() => null);
  steps.push("08_identity");

  // STEP 09 — pattern (Sunday)
  if (bp && isDayOfWeek("sunday")) {
    await runPatternAnalysis(userId, bp.id).catch(() => null);
  }
  steps.push("09_pattern");

  // STEP 09B — weekly skill gap reassessment (Sunday)
  if (isDayOfWeek("sunday")) {
    const { getActiveCapabilityGaps } = await import("../engines/academy/CapabilityGapEngine.js");
    const { assessSkillLevel } = await import("../engines/academy/CapabilityGapEngine.js");
    const { checkWeeklyMasteryEvidence } = await import(
      "../engines/academy/MasteryAssessmentEngine.js"
    );
    const gaps = await getActiveCapabilityGaps(userId).catch(() => []);
    for (const gap of gaps) {
      await assessSkillLevel(userId, gap.gap_type).catch(() => null);
      await checkWeeklyMasteryEvidence(userId, gap).catch(() => null);
    }
  }
  steps.push("09b_skill_gap");

  // STEP 10 — character (Sunday)
  if (isDayOfWeek("sunday")) {
    await updateCharacterScores(userId).catch(() => null);
    if (bp) {
      await checkAndGenerateRewards(userId, {}, bp.id).catch(() => null);
    }
  }
  steps.push("10_character");

  // STEP 11 — task pre-generation
  let preGeneratedOrderId: string | undefined;
  if (bp) {
    const gen = await generateNextTask(userId, {
      blueprintId: bp.id,
      reason: "PRE_GENERATED",
      generationMode: "daily",
    }).catch(() => ({ order: null }));

    if (gen.order) {
      await db
        .update(orders)
        .set({ status: "pre_generated" })
        .where(eq(orders.id, gen.order.id));
      preGeneratedOrderId = gen.order.id;
    }
  }
  steps.push("11_task_pregen");

  // STEP 12 — morning report (+ academy section)
  const { getAcademyMorningSection } = await import("../engines/academy/LearningPathGenerator.js");
  const academySection = await getAcademyMorningSection(userId).catch(() => null);

  const [report] = await db
    .insert(morningReports)
    .values({
      user_id: userId,
      blueprint_id: bp?.id,
      report_date: reportDate,
      eis_section: { ...eisSection, academySection },
      signal_summary: {
        worldStateVersion: stateVersion,
        burnoutAlert: burnout?.risk_level !== "LOW" ? burnout : null,
        academySection,
      },
      next_task_preview: preGeneratedOrderId ? { orderId: preGeneratedOrderId } : null,
      report_body: {
        stepsCompleted: 17,
        steps,
        context,
        criticReviewed: true,
        academySection,
      },
    })
    .onConflictDoUpdate({
      target: [morningReports.user_id, morningReports.report_date],
      set: {
        eis_section: eisSection,
        signal_summary: {
          worldStateVersion: stateVersion,
          burnoutAlert: burnout?.risk_level !== "LOW" ? burnout : null,
        },
        next_task_preview: preGeneratedOrderId ? { orderId: preGeneratedOrderId } : null,
        report_body: { stepsCompleted: 16, steps, context },
      },
    })
    .returning({ id: morningReports.id });
  steps.push("12_morning_report");

  const { refreshDashboardIntelligence } = await import("../engines/dashboard/DashboardIntelligenceEngine.js");
  await refreshDashboardIntelligence(userId, "OVERNIGHT_COMPLETE").catch(() => null);

  // STEP 13 — memory writeback
  await writeMemory({
    userId,
    blueprintId: bp?.id,
    memoryType: "EXECUTION_PATTERN",
    scope: "USER",
    content: `Overnight summary ${reportDate}`,
    sourceType: "overnight_worker",
    confidence: "MEDIUM",
  }).catch(() => null);
  steps.push("13_memory");

  // STEP 14 — self-improvement
  await runDailyEvaluation(userId).catch((err) => {
    logger.warn({ err }, "[OvernightWorker] Self-improvement daily evaluation failed");
  });
  await writeStabilityPatternSummary(userId).catch(() => null);
  if (isDayOfWeek("sunday")) {
    await runWeeklyCalibration().catch((err) => {
      logger.warn({ err }, "[OvernightWorker] Weekly calibration failed");
    });
  }
  steps.push("14_self_improvement");

  // STEP 15 — task guarantee + complete event
  await ensureActiveOrder(userId).catch((err) => {
    logger.warn({ err }, "[OvernightWorker] Task guarantee failed");
  });
  steps.push("15_task_guarantee");

  await updateWorldModel(userId, "SCHEDULED");

  const reportId = report?.id ?? "";

  await emitEvent({
    eventType: EVENT_TYPES.OVERNIGHT_COMPLETE,
    sourceEngine: "overnight_worker",
    userId,
    blueprintId: bp?.id,
    payload: { phase: "started", reportDate },
    idempotencyKey: overnightKey,
    entityType: "user",
    entityId: userId,
    ttlHours: 24,
  }).catch(() => null);

  await storeIdempotencyResult(overnightKey, { reportId, steps });

  await emitEvent({
    eventType: EVENT_TYPES.OVERNIGHT_COMPLETE,
    sourceEngine: "overnight_worker",
    userId,
    blueprintId: bp?.id,
    payload: { reportId, steps, reportDate },
    idempotencyKey: `${overnightKey}:complete`,
    entityType: "user",
    entityId: userId,
  }).catch(() => null);

  logger.info({ userId, reportId, steps: steps.length }, "[OvernightWorker] 16-step cycle complete");
  return { reportId };
}
