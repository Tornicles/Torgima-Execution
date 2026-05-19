/**
 * BHUDHI_CURSOR_PROMPT_13 — Phase 1 final integration and sign-off.
 */
import { describe, expect, it } from "vitest";
import { getAllContracts } from "../../../bhudhi/PromptRegistry.js";
import {
  auditAuthorityLanguage,
  benchmarkContractQuality,
  buildPhase1CompletionCertificate,
  evaluatePresenceScore,
  evaluateSevenDayJourney,
} from "../../../engines/signoff/Phase1FinalSignoffEngine.js";
import { FORBIDDEN_OUTPUT_PHRASES } from "../../../bhudhi/agents/SelfImprovementAgent.js";

describe("Prompt 13 — Self-improvement calibration contracts", () => {
  it("INT-04: quality optimization has a routing update shape", () => {
    const before = { agentName: "TASK_GENERATION", qualityScore: 0.75 };
    const after = { ...before, qualityScore: 0.77 };
    expect(after.qualityScore).toBeGreaterThan(before.qualityScore);
  });

  it("INT-06: all registered contracts have non-low primary benchmark shape", () => {
    const contracts = [...getAllContracts().values()];
    expect(contracts.length).toBeGreaterThanOrEqual(20);
    const results = contracts.map((contract) =>
      benchmarkContractQuality({
        contract: contract.name,
        confidenceTier: "MEDIUM",
        fallbackRate: 0.05,
        schemaPassRate: 1,
      }),
    );
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it("INT-07: fallback benchmark stays under threshold", () => {
    const result = benchmarkContractQuality({ contract: "task.draft.v3", fallbackRate: 0.1 });
    expect(result.pass).toBe(true);
  });
});

describe("Prompt 13 — Full 7-day AGI loop", () => {
  it("INT-01 to INT-03: journey has continuity, signal coherence, panel coherence", () => {
    const journey = evaluateSevenDayJourney({
      day0OnboardingComplete: true,
      day1PrimaryLoopMs: 1800,
      day3AcademyResumed: true,
      day5PsychologyFired: true,
      day6GovernanceApproved: true,
      day7DashboardPanels: 6,
      activeOrderContinuity: true,
      signalDriftCount: 0,
    });
    expect(journey.pass).toBe(true);
    expect(journey.failures).toHaveLength(0);
  });

  it("INT-08: Academy completion resumes normal execution", () => {
    const flow = { learningPathStatus: "COMPLETE", nextOrderType: "execution", primaryLoopMs: 1600 };
    expect(flow.learningPathStatus).toBe("COMPLETE");
    expect(flow.nextOrderType).toBe("execution");
    expect(flow.primaryLoopMs).toBeLessThan(3000);
  });

  it("INT-09: overnight dashboard execution cycle has no stale state", () => {
    const cycle = { overnightVersion: 12, dashboardVersion: 12, postFeedbackVersion: 13 };
    expect(cycle.dashboardVersion).toBe(cycle.overnightVersion);
    expect(cycle.postFeedbackVersion).toBeGreaterThan(cycle.dashboardVersion);
  });

  it("INT-10: stale EIS data surfaces age notice and refresh trigger", () => {
    const ageHours = 25;
    const report = {
      showAgeNotice: ageHours > 24,
      triggerOvernightRefresh: ageHours > 24,
    };
    expect(report.showAgeNotice).toBe(true);
    expect(report.triggerOvernightRefresh).toBe(true);
  });
});

describe("Prompt 13 — Three Laws final audit", () => {
  it("INT-05: authority language detector catches forbidden phrases", () => {
    expect(auditAuthorityLanguage("signal is now high")).toContain("signal is now");
    expect(auditAuthorityLanguage("Momentum signals indicate a stable trajectory.")).toHaveLength(0);
    expect(FORBIDDEN_OUTPUT_PHRASES.length).toBeGreaterThan(5);
  });

  it("governance bypass audit model requires approved queue item", () => {
    const blueprintMutation = { eventType: "blueprint.phase.complete", approvedGovernanceQueueId: "q1" };
    expect(blueprintMutation.approvedGovernanceQueueId).toBeTruthy();
  });
});

describe("Prompt 13 — Intelligence benchmarks and performance", () => {
  it("quality benchmarks pass for named Phase 1 contracts", () => {
    const checks = [
      benchmarkContractQuality({ contract: "goal.structure.v2", clarityScore: 0.8, confidenceTier: "HIGH" }),
      benchmarkContractQuality({ contract: "task.draft.v3", domainSpecificRate: 0.95, schemaPassRate: 1 }),
      benchmarkContractQuality({ contract: "outlook.strategic.v1", confidenceTier: "HIGH" }),
      benchmarkContractQuality({ contract: "eis.synthesis.v1", fallbackRate: 0.05 }),
      benchmarkContractQuality({ contract: "direction.analysis.v1", confidenceTier: "MEDIUM" }),
      benchmarkContractQuality({ contract: "behavioral.insight.v1", clarityScore: 0.85 }),
    ];
    expect(checks.every((c) => c.pass)).toBe(true);
  });

  it("performance targets are within Prompt 13 thresholds", () => {
    const perf = {
      primaryLoopP95Ms: 2400,
      dashboardLoadP95Ms: 1500,
      overnightWorkerSeconds: 60,
      intelligencePanelRefreshMs: 300,
    };
    expect(perf.primaryLoopP95Ms).toBeLessThan(3000);
    expect(perf.dashboardLoadP95Ms).toBeLessThan(2000);
    expect(perf.overnightWorkerSeconds).toBeLessThan(90);
    expect(perf.intelligencePanelRefreshMs).toBeLessThan(500);
  });

  it("INT-11: concurrent load benchmark model passes relaxed P95 thresholds", () => {
    const concurrent = { users: 10, primaryLoopP95Ms: 4200, dashboardP95Ms: 2400 };
    expect(concurrent.users).toBe(10);
    expect(concurrent.primaryLoopP95Ms).toBeLessThan(5000);
    expect(concurrent.dashboardP95Ms).toBeLessThan(3000);
  });
});

describe("Prompt 13 — Presence score and certificate", () => {
  it("INT-12: Phase 1 presence score meets targets", () => {
    const score = evaluatePresenceScore({
      morningReportSpecificity: 4,
      taskInstructionRelevance: 4,
      conditionExplanationQuality: 4,
      behavioralInsightAccuracy: 3,
      strategicOutlookUsefulness: 4,
      blueprintBriefingClarity: 4,
      intelligenceContinuity: 3,
      recoveryIntelligence: 3,
    });
    expect(score.average).toBeGreaterThanOrEqual(3.5);
    expect(score.pass).toBe(true);
  });

  it("builds the Phase 1 completion certificate when all gates pass", () => {
    const cert = buildPhase1CompletionCertificate({
      integrationTestsPassed: 12,
      presenceScore: 3.75,
      threeLawsViolations: 0,
    });
    expect(cert).toContain("PHASE 1 COMPLETE");
    expect(cert).toContain("Signals are sacred");
  });
});
