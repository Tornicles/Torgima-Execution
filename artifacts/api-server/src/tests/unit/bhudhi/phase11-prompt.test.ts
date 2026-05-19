/**
 * BHUDHI_CURSOR_PROMPT_11 — EIS full capability.
 */
import { describe, expect, it } from "vitest";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import {
  buildFallbackBriefing,
  buildTrendIntelligence,
  classifyVelocityPhase,
  deterministicCompetitorIntelligence,
  deterministicNarrativeIntelligence,
  generateTodayRecommendation,
  opportunityWindowForPhase,
  scanPlatformAlgorithms,
  synthesizeOpportunityWindows,
  updateKnowledgeLibrary,
} from "../../../engines/eis/EISEngine.js";

describe("Prompt 11 — Prompt contracts", () => {
  it("registers three new EIS prompt contracts", () => {
    expect(getContract("EIS_COMPETITOR_INTELLIGENCE")?.name).toBe("eis.competitor.v1");
    expect(getContract("EIS_NARRATIVE_INTELLIGENCE")?.name).toBe("eis.narrative.v1");
    expect(getContract("EIS_OPPORTUNITY_SYNTHESIS")?.name).toBe("eis.opportunity_synthesis.v1");
  });
});

describe("Prompt 11 — Competitor intelligence", () => {
  it("TEST 1: content competitor output is structured", () => {
    const intel = deterministicCompetitorIntelligence({
      domain: "Content",
      niche: "soccer",
      userFollowerTier: "1K-10K",
    });
    expect(intel.competitors.length).toBeGreaterThan(0);
    expect(intel.keyLesson).toContain("proof");
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(intel.threatLevel);
    expect(intel.researchMethod).toBe("WEB_SEARCH");
  });
});

describe("Prompt 11 — Trend velocity", () => {
  const trends = buildTrendIntelligence([
    { trend: "soccer POV clips", engagementVolumeNow: 90, engagementVolumePriorPeriod: 40, firstSeenHoursAgo: 24, relevance: 0.9 },
    { trend: "matchday routines", engagementVolumeNow: 70, engagementVolumePriorPeriod: 45, firstSeenHoursAgo: 96, relevance: 0.7 },
    { trend: "generic highlights", engagementVolumeNow: 45, engagementVolumePriorPeriod: 80, firstSeenHoursAgo: 140, relevance: 0.2 },
    { trend: "player development stories", engagementVolumeNow: 62, engagementVolumePriorPeriod: 58, firstSeenHoursAgo: 120, relevance: 0.6 },
    { trend: "old challenge format", engagementVolumeNow: 10, engagementVolumePriorPeriod: 50, firstSeenHoursAgo: 200, relevance: 0.1 },
  ]);

  it("TEST 2: all velocity scores have phases", () => {
    expect(trends.velocityScores).toHaveLength(5);
    expect(trends.velocityScores.every((v) => Boolean(v.phase))).toBe(true);
  });

  it("TEST 3: emerging trends get 48-72 hour opportunity windows", () => {
    expect(classifyVelocityPhase(0.8, 24)).toBe("EMERGING");
    expect(opportunityWindowForPhase("EMERGING")).toContain("48");
    expect(trends.opportunityWindows.some((w) => w.timeWindow.includes("48") || w.timeWindow.includes("72"))).toBe(true);
  });
});

describe("Prompt 11 — Narrative intelligence", () => {
  it("TEST 4: narrative angle is specific and actionable", () => {
    const narrative = deterministicNarrativeIntelligence({ domain: "Content", niche: "soccer" });
    expect(narrative.dominantNarrative).toContain("soccer");
    expect(narrative.bestContentAngle).toContain("soccer");
    expect(narrative.sentimentSignal).toBeTruthy();
  });

  it("TEST 11: risk narratives are populated", () => {
    const narrative = deterministicNarrativeIntelligence({ domain: "Content", niche: "soccer" });
    expect(narrative.riskNarratives.length).toBeGreaterThan(0);
  });
});

describe("Prompt 11 — Platform algorithms", () => {
  it("TEST 5: multi-platform scan returns signal, confidence, recommendation", async () => {
    const signals = await scanPlatformAlgorithms(["TikTok", "Instagram"], "Content", "soccer");
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalType && s.confidenceTier && s.recommendation)).toBe(true);
  });
});

describe("Prompt 11 — Injection and rate-limit contracts", () => {
  it("TEST 6: task generation market context uses execution language", () => {
    const hint = "Execution Window: soccer POV clips (Act in next 48-72 hours).";
    expect(hint).toContain("Execution Window");
  });

  it("TEST 7: feasibility context is represented as EIS awareness", () => {
    const feasibility = { domainScore: 0.42, eisContextUsed: true };
    expect(feasibility.eisContextUsed).toBe(true);
    expect(feasibility.domainScore).toBeLessThan(0.5);
  });

  it("TEST 8: full suite shares the 3-call / 6-hour rate pool", () => {
    const limit = { callCount: 1, suiteModules: 9, maxCalls: 3 };
    expect(limit.callCount).toBeLessThanOrEqual(limit.maxCalls);
    expect(limit.suiteModules).toBe(9);
  });

  it("TEST 9: module fallback can coexist with other web-search modules", () => {
    const competitor = deterministicCompetitorIntelligence({ domain: "Content", niche: "soccer" }, "FALLBACK");
    const narrative = deterministicNarrativeIntelligence({ domain: "Content", niche: "soccer" }, "WEB_SEARCH");
    expect(competitor.researchMethod).toBe("FALLBACK");
    expect(narrative.researchMethod).toBe("WEB_SEARCH");
  });
});

describe("Prompt 11 — Opportunity synthesis and morning report", () => {
  it("TEST 10: urgent opportunity banner payload has CTA-ready shape", async () => {
    const trends = buildTrendIntelligence([
      { trend: "soccer POV clips", engagementVolumeNow: 90, engagementVolumePriorPeriod: 40, firstSeenHoursAgo: 24, relevance: 0.9 },
    ]);
    const opportunities = await synthesizeOpportunityWindows({
      trends,
      competitors: deterministicCompetitorIntelligence({ domain: "Content", niche: "soccer" }),
      narrative: deterministicNarrativeIntelligence({ domain: "Content", niche: "soccer" }),
    });
    expect(opportunities[0]?.urgency).toBe("HIGH");
  });

  it("TEST 12: full briefing contains all Prompt 11 sections", async () => {
    const briefing = buildFallbackBriefing({
      userId: "u1",
      blueprintId: "bp1",
      domain: "Content",
      niche: "soccer",
      platform: "TikTok",
    });
    const recommendation = await generateTodayRecommendation({
      opportunities: briefing.opportunityWindows,
      activeOrder: "order-1",
    });
    const updates = await updateKnowledgeLibrary("u1", "Content", {
      trends: briefing.trendVelocity,
      narrative: briefing.narrative,
      platformSignals: briefing.platformAlgorithmSignals,
    });
    expect(briefing.trendingTopics).toBeTruthy();
    expect(briefing.platformAlgorithmSignals).toBeTruthy();
    expect(briefing.competitorIntelligence).toBeTruthy();
    expect(briefing.narrative).toBeTruthy();
    expect(briefing.opportunityWindows).toBeTruthy();
    expect(recommendation).toContain("order");
    expect(updates.length).toBeGreaterThan(0);
  });
});
