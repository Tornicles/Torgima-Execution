import { describe, it, expect } from "vitest";
import { BHUDHI_ENGINES, BHUDHI_FRAMEWORKS, BHUDHI_SYSTEMS } from "@workspace/db/bhudhi-seed-data";
import { INVESTIGATION_ENGINE_RUNNERS } from "../../../bhudhi/investigation/engines.js";
import {
  frameworkApplicatorEngine,
  contradictionResolutionEngine,
  scenarioSimulatorEngine,
  recommendationEngine,
  enrichRecommendation,
} from "../../../bhudhi/intelligence/intelligenceEngines.js";
import { validateBeforeExecution } from "../../../bhudhi/operating/securityGate.js";
import { calculateGlobalSignal, getSignalInterpretation } from "../../../bhudhi/signals/signalCalculation.js";
import { frameworksService } from "../../../bhudhi/frameworks/FrameworksService.js";
import { evaluateRecommendationChecks } from "../../../bhudhi/security/securityLogic.js";
import { extractLearningsFromEvents } from "../../../bhudhi/preservation/preservationLogic.js";
import { findPatterns, extractInsights } from "../../../bhudhi/external/externalAnalysis.js";
import { fetchCRMData } from "../../../bhudhi/external/externalDataProviders.js";
import type { BhudhiInvestigation } from "@workspace/db/types/bhudhi";

const sampleInvestigations: BhudhiInvestigation[] = [
  {
    id: "inv-1",
    blueprintId: "integration-test",
    engineId: "inv_data_collection",
    subject: "execution",
    findings: {
      patterns: ["task_completed (×4)"],
      anomalies: [],
      insights: ["Collected 10 order executions", "Strategy is clear", "Customer satisfaction stable"],
      rootCauses: [],
      benchmarks: { tasksPerDay: 4 },
    },
    confidence: 0.9,
    severity: "low",
    actionable: true,
  },
];

describe("BHUDHI PROMPT 12 — End-to-end cycle (pure)", () => {
  it("catalog has 5 systems and 40+ engines", () => {
    expect(BHUDHI_SYSTEMS).toHaveLength(5);
    expect(BHUDHI_ENGINES.length).toBeGreaterThanOrEqual(40);
    expect(BHUDHI_FRAMEWORKS.length).toBe(15);
  });

  it("investigation → intelligence → operating security gate", () => {
    expect(Object.keys(INVESTIGATION_ENGINE_RUNNERS).length).toBeGreaterThanOrEqual(13);

    const frameworkAnalysis = frameworkApplicatorEngine(sampleInvestigations, [
      {
        id: "strategycore",
        name: "STRATEGYCORE",
        type: "team",
        description: "",
        accuracy: 0.75,
        status: "active",
      },
      {
        id: "synergyops",
        name: "SYNERGYOPS",
        type: "team",
        description: "",
        accuracy: 0.7,
        status: "active",
      },
    ]);
    const resolved = contradictionResolutionEngine(frameworkAnalysis);
    const scenarios = scenarioSimulatorEngine("integration-test", resolved);
    const drafts = recommendationEngine(resolved, scenarios);
    expect(drafts.length).toBeGreaterThan(0);

    const enriched = enrichRecommendation(drafts[0]!, scenarios, 0, 0, true, []);
    expect(enriched.confidence).toBeGreaterThanOrEqual(0);
    expect(enriched.confidence).toBeLessThanOrEqual(1);

    const gate = validateBeforeExecution({
      id: "rec-1",
      blueprintId: "integration-test",
      engineId: "int_recommendation_engine",
      title: enriched.title,
      description: enriched.description,
      reasoning: enriched.reasoning,
      expectedImpact: enriched.expectedImpact,
      confidence: enriched.confidence,
      implementationDifficulty: enriched.implementationDifficulty,
      status: "approved",
      risks: enriched.risks,
      feasibility: enriched.feasibility,
      strategicAlignment: enriched.strategicAlignment,
    });
    expect(gate.allowed).toBe(true);
  });

  it("signals + frameworks + security + preservation + external", () => {
    const signal = calculateGlobalSignal({
      completionRate: 0.72,
      momentum: 0.6,
      trend: "stable",
      confidenceLevel: 0.7,
      confidence: 0.7,
      clarity: 0.65,
      throughput: 0.7,
      feedbackRate: 0.8,
      riskScore: 0.2,
    });
    expect(getSignalInterpretation(signal).length).toBeGreaterThan(0);

    const fw = frameworksService.evaluateFramework("STRATEGYCORE", sampleInvestigations);
    expect(fw?.signal).toBeTruthy();

    const security = evaluateRecommendationChecks(
      { expectedRevenue: 10_000, riskProbability: 0.2, strategicallyAligned: true },
      true,
    );
    expect(security.valid).toBe(true);

    const learnings = extractLearningsFromEvents(
      Array.from({ length: 22 }, () => ({
        event_type: "task_completed",
        description: "order completed",
        data: { status: "completed" },
        learnings_generated: ["learned"],
        frameworks_improved: ["fw1"],
      })),
    );
    expect(learnings.length).toBeGreaterThan(0);

    const crm = fetchCRMData();
    expect(findPatterns(crm).length + extractInsights(crm).length).toBeGreaterThan(0);
  });
});
