/**
 * 13 investigation engines — each returns EngineFindingResult for persistence.
 */
import type { InvestigationEngineName } from "./types.js";
import type { EngineFindingResult } from "./types.js";
import * as data from "./investigationData.js";

export type EngineRunner = (blueprintId: string) => Promise<EngineFindingResult>;

export const INVESTIGATION_ENGINE_RUNNERS: Record<InvestigationEngineName, EngineRunner> = {
  "Data Collection Engine": async (blueprintId) => {
    const executionData = await data.getExecutionData(blueprintId);
    const externalData = await data.getExternalData(blueprintId);
    return {
      patterns: [],
      anomalies: [],
      insights: [
        `Collected ${executionData.taskCount} task executions`,
        `Collected ${executionData.feedbackCount} feedback entries`,
        `Connected to ${externalData.connectionCount} external systems`,
        `Total data points: ${executionData.dataPoints + externalData.dataPoints}`,
      ],
      rootCauses: [],
      benchmarks: {
        tasksPerDay: executionData.tasksPerDay,
        feedbackRate: executionData.feedbackRate,
      },
      confidence: 0.95,
      actionable: true,
    };
  },

  "Pattern Discovery Engine": async (blueprintId) => {
    const executionEvents = await data.getExecutionEvents(blueprintId);
    const exec = await data.getExecutionData(blueprintId);
    const patterns = data.findRecurringPatterns(executionEvents);
    const correlations = data.findCorrelations(exec);
    return {
      patterns: patterns.map((p) => `${p.name} (×${p.frequency})`),
      anomalies: [],
      insights: [
        ...patterns.map((p) => `Pattern: ${p.name} (frequency: ${p.frequency})`),
        ...correlations.map((c) => `Correlation: ${c.a} → ${c.b} (${c.strength}%)`),
      ],
      rootCauses: [],
      benchmarks: { patternCount: patterns.length, correlationCount: correlations.length },
      confidence: patterns.length > 0 ? 0.85 : 0.5,
      actionable: patterns.length > 3,
    };
  },

  "Anomaly Detection Engine": async (blueprintId) => {
    const executionData = await data.getExecutionData(blueprintId);
    const anomalies = data.detectAnomalies(executionData);
    const avgSeverity =
      anomalies.length > 0
        ? anomalies.reduce(
            (sum, a) => sum + (a.severity === "high" ? 3 : a.severity === "medium" ? 2 : 1),
            0,
          ) / anomalies.length
        : 0;
    return {
      patterns: [],
      anomalies: anomalies.map((a) => a.description),
      insights: [
        `Found ${anomalies.length} anomalies`,
        ...anomalies.map((a) => `Anomaly: ${a.description} (severity: ${a.severity})`),
      ],
      rootCauses: [],
      benchmarks: { anomalyCount: anomalies.length, avgSeverity },
      confidence: 0.8,
      severity: anomalies.length > 0 ? "medium" : "low",
      actionable: anomalies.length > 0,
    };
  },

  "Root Cause Analysis Engine": async (blueprintId) => {
    const anomalies = await data.getStoredAnomalies(blueprintId);
    const rootCauses = [];
    for (const anomaly of anomalies) {
      const cause = await data.analyzeRootCause(blueprintId, anomaly);
      if (cause) rootCauses.push(cause);
    }
    return {
      patterns: [],
      anomalies: [],
      insights: rootCauses.map(
        (rc) => `Root cause: ${rc.cause} (confidence: ${Math.round(rc.confidence * 100)}%)`,
      ),
      rootCauses,
      benchmarks: { rootCauseCount: rootCauses.length },
      confidence: 0.75,
      actionable: rootCauses.length > 0,
    };
  },

  "Comparative Benchmarking Engine": async (blueprintId) => {
    const bp = await data.loadBlueprint(blueprintId);
    const metrics = await data.getBlueprintMetrics(blueprintId);
    const benchmarks = data.getBenchmarks(bp?.domain ?? "delivery");
    const gaps = data.calculateGaps(metrics, benchmarks);
    return {
      patterns: [],
      anomalies: [],
      insights: gaps.map((g) => `Gap: ${g.metric} is ${g.percentDiff}% below benchmark`),
      rootCauses: [],
      benchmarks: {
        metricsAnalyzed: gaps.length,
        avgGap: gaps.length ? gaps.reduce((s, g) => s + g.percentDiff, 0) / gaps.length : 0,
      },
      confidence: 0.8,
      actionable: gaps.length > 0,
    };
  },

  "Hidden Insight Engine": async (blueprintId) => {
    const executionData = await data.getExecutionData(blueprintId);
    const insights = data.mineHiddenInsights(executionData);
    return {
      patterns: [],
      anomalies: [],
      insights,
      rootCauses: [],
      benchmarks: { insightCount: insights.length },
      confidence: 0.65,
      actionable: insights.length > 0,
    };
  },

  "System Topology Engine": async (blueprintId) => {
    const dependencies = await data.mapDependencies(blueprintId);
    const criticalPaths = data.findCriticalPaths(dependencies);
    const bottlenecks = data.findBottlenecks(dependencies);
    return {
      patterns: [],
      anomalies: [],
      insights: [
        `System has ${dependencies.length} dependencies`,
        `${criticalPaths.length} critical paths identified`,
        `${bottlenecks.length} potential bottlenecks found`,
      ],
      rootCauses: [],
      benchmarks: {
        dependencyCount: dependencies.length,
        criticalPathCount: criticalPaths.length,
        bottleneckCount: bottlenecks.length,
      },
      confidence: 0.85,
      actionable: bottlenecks.length > 0,
    };
  },

  "Vulnerability Assessment Engine": async (blueprintId) => {
    const vulnerabilities = await data.assessVulnerabilities(blueprintId);
    return {
      patterns: [],
      anomalies: [],
      insights: vulnerabilities.map((v) => `Vulnerability: ${v.name} (risk: ${v.risk})`),
      rootCauses: [],
      benchmarks: {
        vulnerabilityCount: vulnerabilities.length,
        highRiskCount: vulnerabilities.filter((v) => v.risk === "high").length,
      },
      confidence: 0.8,
      severity: vulnerabilities.some((v) => v.risk === "high") ? "high" : "medium",
      actionable: true,
    };
  },

  "Financial Analysis Engine": async (blueprintId) => {
    const financialData = await data.getFinancialData(blueprintId);
    return {
      patterns: [],
      anomalies: [],
      insights: [
        `Revenue: ${financialData.revenue}`,
        `Burn rate: ${financialData.burnRate} per month`,
        `Cash runway: ${financialData.runway} months`,
        `Margin: ${financialData.margin}%`,
      ],
      rootCauses: [],
      benchmarks: financialData,
      confidence: 0.9,
      actionable: financialData.runway > 0 && financialData.runway < 6,
    };
  },

  "Operational Metrics Engine": async (blueprintId) => {
    const metrics = await data.getOperationalMetrics(blueprintId);
    return {
      patterns: [],
      anomalies: [],
      insights: [
        `Velocity: ${metrics.velocity} points/week`,
        `Throughput: ${metrics.throughput} tasks/day`,
        `Quality: ${metrics.quality}%`,
        `Utilization: ${metrics.utilization}%`,
      ],
      rootCauses: [],
      benchmarks: metrics,
      confidence: 0.85,
      actionable: true,
    };
  },

  "Competitive Intelligence Engine": async (blueprintId) => {
    const competitiveData = await data.gatherCompetitiveData(blueprintId);
    return {
      patterns: [],
      anomalies: [],
      insights: competitiveData.insights,
      rootCauses: [],
      benchmarks: {
        competitorsTracked: competitiveData.competitors.length,
        marketShare: competitiveData.marketShare,
      },
      confidence: 0.7,
      actionable: true,
    };
  },

  "Sentiment & Culture Engine": async (blueprintId) => {
    const sentimentData = await data.analyzeSentiment(blueprintId);
    return {
      patterns: [],
      anomalies: sentimentData.anomalies,
      insights: sentimentData.insights,
      rootCauses: [],
      benchmarks: {
        avgSentiment: sentimentData.avgSentiment,
        morale: sentimentData.morale,
      },
      confidence: 0.75,
      severity: sentimentData.avgSentiment < 0.5 ? "high" : "low",
      actionable: sentimentData.anomalies.length > 0,
    };
  },

  "Compliance & Risk Engine": async (blueprintId) => {
    const complianceData = await data.assessCompliance(blueprintId);
    return {
      patterns: [],
      anomalies: [],
      insights: complianceData.issues.map((i) => `Compliance issue: ${i.name}`),
      rootCauses: [],
      benchmarks: {
        complianceScore: complianceData.score,
        riskScore: complianceData.riskScore,
      },
      confidence: 0.9,
      severity: complianceData.score < 0.7 ? "high" : "low",
      actionable: complianceData.issues.length > 0,
    };
  },
};
