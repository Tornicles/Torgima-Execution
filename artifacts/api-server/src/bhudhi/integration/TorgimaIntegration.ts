import { investigationService } from "../investigation/InvestigationService.js";
import { intelligenceService } from "../intelligence/IntelligenceService.js";
import { signalService } from "../signals/SignalService.js";
import { domainsService } from "../domains/DomainsService.js";
import { resolveDomainFromEventCount } from "../domains/domainLogic.js";
import {
  frameworkApplicatorEngine,
  recommendationEngine,
  contradictionResolutionEngine,
  scenarioSimulatorEngine,
} from "../intelligence/intelligenceEngines.js";
import type { BhudhiInvestigation } from "@workspace/db/types/bhudhi";
import { modulesService } from "../modules/ModulesService.js";
import type { Bhudhi20CycleResult } from "../modules/ModulesService.js";
import { logger } from "../../lib/logger.js";

export interface TaskFeedbackBhudhiResult {
  nextTaskRecommendation: {
    id: string;
    title: string;
    description: string;
    reasoning: string;
    confidence: number;
  } | null;
  signals: string;
  insights: string[];
  investigationCount: number;
  recommendationCount: number;
  /** BHUDHI PROMPT 13 — optional Bhudhi 2.0 module cycle */
  bhudhi20?: Bhudhi20CycleResult | null;
}

export interface GoalValidationBhudhiResult {
  validated: boolean;
  confidence: number;
  insights: string[];
  recommendations: Array<{ title: string; description: string; confidence: number }>;
}

export interface DomainTransitionBhudhiResult {
  transition: boolean;
  newDomain: string;
  currentDomain?: string;
}

function extractInsights(investigations: BhudhiInvestigation[]): string[] {
  return investigations.flatMap((inv) => {
    const findings = inv.findings as { insights?: string[] };
    return Array.isArray(findings?.insights) ? findings.insights : [];
  });
}

/** Orchestrates Bhudhi cycle after Torgima order feedback (Prompt 12). */
export class TorgimaIntegration {
  async processTaskFeedback(
    blueprintId: string,
    _taskId: string,
    _feedback?: Record<string, unknown>,
  ): Promise<TaskFeedbackBhudhiResult> {
    const investigations = await investigationService.investigateBlueprint(blueprintId);
    const recommendations = await intelligenceService.analyzeAndRecommend(blueprintId);
    const signals = await signalService.calculateSignals(blueprintId);

    const sorted = [...recommendations].sort((a, b) => b.confidence - a.confidence);
    const top = sorted[0] ?? null;

    let bhudhi20: Bhudhi20CycleResult | null = null;
    try {
      bhudhi20 = await modulesService.runCompleteCycle(blueprintId);
    } catch (err) {
      logger.warn({ err, blueprintId }, "[TorgimaIntegration] Bhudhi 2.0 cycle skipped");
    }

    logger.info(
      {
        blueprintId,
        investigations: investigations.length,
        recommendations: recommendations.length,
        globalSignal: signals.globalSignal,
        bhudhi20: Boolean(bhudhi20),
      },
      "[TorgimaIntegration] feedback cycle complete",
    );

    return {
      nextTaskRecommendation: top,
      signals: signals.globalSignal,
      insights: extractInsights(investigations).slice(0, 5),
      investigationCount: investigations.length,
      recommendationCount: recommendations.length,
      bhudhi20,
    };
  }

  /** Lightweight Erector-aligned goal check using intelligence engines (no blueprint required). */
  async validateGoalWithBhudhi(goal: string, purpose: string): Promise<GoalValidationBhudhiResult> {
    const synthetic: BhudhiInvestigation[] = [
      {
        id: "synthetic-erector",
        blueprintId: "erector-validation",
        engineId: "inv_data_collection",
        subject: "execution",
        findings: {
          patterns: goal.length >= 20 ? ["Goal has sufficient detail"] : [],
          anomalies: goal.length < 10 ? ["Goal may be too vague"] : [],
          insights: [
            `Goal: ${goal.slice(0, 200)}`,
            purpose ? `Purpose: ${purpose.slice(0, 200)}` : "Purpose not specified",
          ],
          rootCauses: [],
          benchmarks: {},
        },
        confidence: goal.length >= 20 ? 0.8 : 0.5,
        severity: "low",
        actionable: true,
      },
    ];

    const frameworkAnalysis = frameworkApplicatorEngine(synthetic, [
      {
        id: "strategycore",
        name: "STRATEGYCORE",
        type: "team",
        description: "",
        domains: [],
        status: "active",
        accuracy: 0.75,
      },
    ]);
    const resolved = contradictionResolutionEngine(frameworkAnalysis);
    const scenarios = scenarioSimulatorEngine("", resolved);
    const drafts = recommendationEngine(resolved, scenarios);

    const recommendations = drafts.map((d) => ({
      title: d.title,
      description: d.description,
      confidence: d.confidence,
    }));

    const confidence =
      recommendations.length > 0
        ? Math.max(...recommendations.map((r) => r.confidence))
        : synthetic[0]!.confidence;

    return {
      validated: goal.trim().length >= 10 && confidence >= 0.45,
      confidence,
      insights: extractInsights(synthetic).slice(0, 5),
      recommendations: recommendations.slice(0, 3),
    };
  }

  async getNextTaskRecommendation(blueprintId: string): Promise<string> {
    let recommendations = await intelligenceService.listRecommendations(blueprintId);
    if (recommendations.length === 0) {
      recommendations = await intelligenceService.analyzeAndRecommend(blueprintId);
    }

    if (recommendations.length === 0) {
      return "Continue current order and document progress in feedback.";
    }

    const top = [...recommendations].sort((a, b) => b.confidence - a.confidence)[0]!;
    return `${top.title}: ${top.description}`;
  }

  async getNextTaskBhudhiPayload(blueprintId: string) {
    let recommendations = await intelligenceService.listRecommendations(blueprintId);
    if (recommendations.length === 0) {
      recommendations = await intelligenceService.analyzeAndRecommend(blueprintId);
    }

    if (recommendations.length === 0) {
      return {
        success: true,
        nextTask: "Reflect on progress and identify next steps based on learnings",
        description: null as string | null,
        reasoning: null as string | null,
        confidence: null as number | null,
      };
    }

    const top = [...recommendations].sort((a, b) => b.confidence - a.confidence)[0]!;
    return {
      success: true,
      nextTask: top.title,
      description: top.description,
      reasoning: top.reasoning,
      confidence: top.confidence,
    };
  }

  async checkDomainTransition(
    blueprintId: string,
    currentDomain = "genesis",
  ): Promise<DomainTransitionBhudhiResult> {
    const check = await domainsService.checkDomainTransition(blueprintId, currentDomain);
    return {
      transition: check.transition,
      newDomain: check.newDomain,
      currentDomain,
    };
  }

  /** Resolve domain from completion rate when metrics are available (Erector path). */
  resolveDomainFromCompletionRate(completionRate: number, globalSignal?: string): string {
    const events =
      completionRate <= 0 ? 0 : completionRate < 0.3 ? 3 : completionRate < 0.5 ? 12 : completionRate < 0.7 ? 50 : completionRate < 0.85 ? 100 : 160;
    return resolveDomainFromEventCount(events, globalSignal);
  }
}

export const torgimaIntegration = new TorgimaIntegration();

/** Run Bhudhi cycle without failing the primary Torgima loop. */
export async function runBhudhiFeedbackCycle(
  blueprintId: string,
  orderId: string,
  feedback?: Record<string, unknown>,
): Promise<TaskFeedbackBhudhiResult | null> {
  try {
    return await torgimaIntegration.processTaskFeedback(blueprintId, orderId, feedback);
  } catch (err) {
    logger.warn({ err, blueprintId, orderId }, "[TorgimaIntegration] feedback cycle skipped");
    return null;
  }
}
