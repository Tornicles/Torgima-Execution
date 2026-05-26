/**
 * Pure intelligence pipeline engines (12 steps).
 */
import type {
  DraftRecommendation,
  EnrichedRecommendation,
  FrameworkAnalysis,
  FrameworkRow,
  InvestigationInput,
  RecommendationDependencies,
  RecommendationFeasibility,
  RecommendationOptimization,
  RecommendationRisks,
  ScenarioSet,
  StakeholderImpact,
  StrategicAlignment,
} from "./types.js";
import { evaluateFramework } from "./frameworks/frameworkLogic.js";
import type { BhudhiExpectedImpact } from "@workspace/db/types/bhudhi";

/** ENGINE 1: Framework Applicator */
export function frameworkApplicatorEngine(
  investigations: InvestigationInput,
  frameworks: FrameworkRow[],
): FrameworkAnalysis {
  const analysis: FrameworkAnalysis = {};
  for (const fw of frameworks) {
    if (fw.status !== "active") continue;
    analysis[fw.id] = evaluateFramework(fw.name, fw.id, investigations);
  }
  return analysis;
}

/** ENGINE 2: Contradiction Resolution */
export function findContradictions(recommendations: string[]): Array<{ rec1: string; rec2: string }> {
  const contradictions: Array<{ rec1: string; rec2: string }> = [];
  for (let i = 0; i < recommendations.length; i++) {
    for (let j = i + 1; j < recommendations.length; j++) {
      if (areContradictory(recommendations[i]!, recommendations[j]!)) {
        contradictions.push({ rec1: recommendations[i]!, rec2: recommendations[j]! });
      }
    }
  }
  return contradictions;
}

export function areContradictory(rec1: string, rec2: string): boolean {
  const k1 = rec1.toLowerCase().split(/\s+/);
  const k2 = rec2.toLowerCase().split(/\s+/);
  return (
    (k1.includes("increase") && k2.includes("decrease")) ||
    (k1.includes("launch") && k2.includes("pause")) ||
    (k1.includes("scale") && k2.includes("pause")) ||
    (k1.includes("expand") && k2.includes("reduce"))
  );
}

export function contradictionResolutionEngine(analysis: FrameworkAnalysis): FrameworkAnalysis {
  const entries = Object.entries(analysis).filter(([, v]) => v.recommendation);
  const recTexts = entries.map(([, v]) => v.recommendation!);
  const contradictions = findContradictions(recTexts);
  const resolved = { ...analysis };

  for (const c of contradictions) {
    const e1 = entries.find(([, v]) => v.recommendation === c.rec1);
    const e2 = entries.find(([, v]) => v.recommendation === c.rec2);
    if (!e1 || !e2) continue;
    const conf1 = e1[1].confidence;
    const conf2 = e2[1].confidence;
    if (conf1 >= conf2) delete resolved[e2[0]];
    else delete resolved[e1[0]];
  }

  return resolved;
}

/** ENGINE 3: Scenario Simulator */
export function scenarioSimulatorEngine(
  _blueprintId: string,
  analysis: FrameworkAnalysis,
): ScenarioSet {
  const avgConfidence =
    Object.values(analysis).reduce((s, v) => s + v.confidence, 0) /
    Math.max(1, Object.values(analysis).length);

  const simulate = (scale: number) => ({
    scale,
    revenue: Math.round(50000 * scale * avgConfidence),
    timeline: Math.max(1, Math.floor(14 / scale)),
    risk: Math.round(30 * scale * (1 - avgConfidence)),
    confidence: Math.min(0.95, 0.65 + avgConfidence * 0.2),
  });

  return {
    conservative: simulate(0.7),
    moderate: simulate(1.0),
    aggressive: simulate(1.3),
  };
}

/** ENGINE 4: Recommendation Engine */
export function recommendationEngine(
  analysis: FrameworkAnalysis,
  scenarios: ScenarioSet,
): DraftRecommendation[] {
  const recommendations: DraftRecommendation[] = [];
  for (const [frameworkId, data] of Object.entries(analysis)) {
    if (!data.recommendation) continue;
    recommendations.push({
      frameworkId,
      title: data.recommendation,
      description: `Based on ${data.framework} framework analysis`,
      reasoning: `Framework detected: ${data.insights.join(", ")}`,
      scenario: selectBestScenario(scenarios),
      confidence: data.confidence,
      implementationDifficulty: estimateDifficulty(data.recommendation),
    });
  }
  return recommendations;
}

function selectBestScenario(scenarios: ScenarioSet): keyof ScenarioSet {
  const scores = (["conservative", "moderate", "aggressive"] as const).map((k) => ({
    k,
    score: scenarios[k].confidence - scenarios[k].risk / 200,
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores[1]?.k ?? "moderate";
}

export function estimateDifficulty(
  recommendation: string,
): "easy" | "medium" | "hard" {
  const lower = recommendation.toLowerCase();
  if (lower.includes("increase") || lower.includes("focus") || lower.includes("maintain")) {
    return "easy";
  }
  if (lower.includes("scale") || lower.includes("recalibrate") || lower.includes("pause")) {
    return "hard";
  }
  return "medium";
}

/** ENGINE 5: Impact Analyzer */
export function impactAnalyzerEngine(
  scenario: keyof ScenarioSet,
  scenarios: ScenarioSet,
  rec: DraftRecommendation,
): BhudhiExpectedImpact {
  const s = scenarios[scenario];
  return {
    revenue: s.revenue,
    efficiency: Math.round(rec.confidence * 50),
    risk: s.risk,
    timeline: s.timeline,
  };
}

/** ENGINE 6: Risk Assessment */
export function riskAssessmentEngine(rec: DraftRecommendation): RecommendationRisks {
  const probability = Math.max(0.1, 1 - rec.confidence);
  const severity: RecommendationRisks["severity"] =
    probability > 0.5 ? "high" : probability > 0.3 ? "medium" : "low";
  return {
    probability: Math.round(probability * 100) / 100,
    severity,
    mitigation: "Risk mitigation plan available",
    contingency: "Contingency plan ready",
  };
}

/** ENGINE 7: Optimization */
export function optimizationEngine(rec: DraftRecommendation): RecommendationOptimization {
  return {
    optimized: true,
    efficiency: Math.min(0.99, 0.7 + rec.confidence * 0.25),
    costReduction: Math.round((1 - rec.confidence) * 20),
  };
}

/** ENGINE 8: Dependency Analyzer */
export function dependencyAnalyzerEngine(
  pendingDeps: number,
  blockerCount: number,
): RecommendationDependencies {
  return {
    dependencies: pendingDeps > 0 ? [`${pendingDeps} order dependencies pending`] : [],
    criticalPath: blockerCount > 0 ? ["Blocked orders on critical path"] : [],
    blockers: blockerCount > 0 ? [`${blockerCount} active blockers`] : [],
  };
}

/** ENGINE 9: Feasibility */
export function feasibilityAssessmentEngine(
  rec: DraftRecommendation,
): RecommendationFeasibility {
  return {
    feasible: rec.confidence >= 0.5,
    difficulty: rec.implementationDifficulty,
    resources: rec.confidence >= 0.6 ? "Available" : "May need support",
    timeline: rec.implementationDifficulty === "hard" ? "6 weeks" : "4 weeks",
    effort: rec.implementationDifficulty === "easy" ? "20 hours" : "40 hours",
  };
}

/** ENGINE 10: Stakeholder Impact */
export function stakeholderImpactEngine(rec: DraftRecommendation): StakeholderImpact {
  return {
    winners: ["operator", "customers"],
    losers: rec.implementationDifficulty === "hard" ? ["short-term velocity"] : [],
    adoptionLikelihood: Math.min(0.95, 0.6 + rec.confidence * 0.35),
    changeManagement: rec.implementationDifficulty === "easy" ? "Light" : "Required",
  };
}

/** ENGINE 11: Strategic Alignment */
export function strategicAlignmentEngine(
  goalAligned: boolean,
  rec: DraftRecommendation,
): StrategicAlignment {
  return {
    aligned: goalAligned && rec.confidence >= 0.55,
    alignmentScore: Math.round((goalAligned ? 0.9 : 0.6) * rec.confidence * 100) / 100,
    strategicValue: rec.confidence >= 0.75 ? "High" : rec.confidence >= 0.6 ? "Medium" : "Low",
    constraints: goalAligned ? [] : ["Re-align recommendation to blueprint goal"],
  };
}

/** ENGINE 12: Learning Integration — applied externally with DB learnings */

export function calculateConfidence(
  rec: DraftRecommendation,
  impact: BhudhiExpectedImpact,
  risks: RecommendationRisks,
  feasibility: RecommendationFeasibility,
  alignment: StrategicAlignment,
): number {
  const weights = { impact: 0.25, risks: 0.15, feasibility: 0.3, alignment: 0.3 };
  let score = 0;
  score += ((impact.efficiency ?? 0) / 100) * weights.impact;
  score += (1 - risks.probability) * weights.risks;
  score += (feasibility.feasible ? 1 : 0) * weights.feasibility;
  score += (alignment.aligned ? alignment.alignmentScore : 0) * weights.alignment;
  return Math.min(1, Math.round(score * 100) / 100);
}

export function enrichRecommendation(
  draft: DraftRecommendation,
  scenarios: ScenarioSet,
  pendingDeps: number,
  blockerCount: number,
  goalAligned: boolean,
  learningsUsed: string[],
): EnrichedRecommendation {
  const impact = impactAnalyzerEngine(draft.scenario, scenarios, draft);
  const risks = riskAssessmentEngine(draft);
  const optimization = optimizationEngine(draft);
  const dependencies = dependencyAnalyzerEngine(pendingDeps, blockerCount);
  const feasibility = feasibilityAssessmentEngine(draft);
  const stakeholderImpact = stakeholderImpactEngine(draft);
  const strategicAlignment = strategicAlignmentEngine(goalAligned, draft);
  const confidence = calculateConfidence(draft, impact, risks, feasibility, strategicAlignment);

  return {
    ...draft,
    confidence,
    expectedImpact: impact,
    risks,
    dependencies,
    feasibility,
    stakeholderImpact,
    strategicAlignment,
    optimization,
    learningsUsed,
  };
}
