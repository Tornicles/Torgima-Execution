/**
 * Re-exports intelligence hooks and APIs so UI components avoid internal product names.
 */
export { useBhudhiDashboard as useIntelligenceDashboard } from "@/hooks/useBhudhiDashboard";
export { bhudhiPath as intelligencePath } from "@/hooks/useBhudhiBlueprint";
export {
  executeBhudhiRecommendation as executeIntelligenceRecommendation,
  fetchBhudhiInsights as fetchIntelligenceInsights,
  fetchBhudhiModules as fetchIntelligenceModules,
  fetchBhudhiNextTask as fetchIntelligenceNextTask,
  fetchBhudhiRecommendations as fetchIntelligenceRecommendations,
  generateBhudhiRecommendations as generateIntelligenceRecommendations,
  runBhudhiCompleteCycle as runIntelligenceCompleteCycle,
  runBhudhiInvestigate as runIntelligenceInvestigate,
} from "@/lib/bhudhi-api";
export type {
  BhudhiRecommendation as IntelligenceRecommendation,
  BhudhiStatusPayload as IntelligenceStatusPayload,
} from "@/lib/bhudhi-api";
export {
  explainBhudhiQuestion as explainIntelligenceQuestion,
  fetchBhudhiHub as fetchIntelligenceHub,
} from "@/lib/bhudhi-hub-api";
export type {
  BhudhiExplainResponse as IntelligenceExplainResponse,
  BhudhiHubPanels as IntelligenceHubPanels,
  BhudhiQuestionCategory as IntelligenceQuestionCategory,
} from "@/lib/bhudhi-hub-types";
export { fetchBhudhiCertification as fetchIntelligenceCertification } from "@/lib/bhudhi-certification-api";
export type { BhudhiCertificationPayload as IntelligenceCertificationPayload } from "@/lib/bhudhi-certification-api";
export {
  fetchBhudhiLaunchConfig as fetchIntelligenceLaunchConfig,
  fetchBhudhiLaunchStatus as fetchIntelligenceLaunchStatus,
} from "@/lib/bhudhi-launch-api";
export type { BhudhiLaunchConfig as IntelligenceLaunchConfig } from "@/lib/bhudhi-launch-api";
export {
  fetchBhudhiMonitoringHealth as fetchIntelligenceMonitoringHealth,
  fetchBhudhiMonitoringMetrics as fetchIntelligenceMonitoringMetrics,
  fetchPlatformHealth,
} from "@/lib/bhudhi-monitoring-api";
export type {
  BhudhiMonitoringHealth as IntelligenceMonitoringHealth,
  BhudhiMonitoringMetrics as IntelligenceMonitoringMetrics,
} from "@/lib/bhudhi-monitoring-api";
export {
  createBhudhiCivilization as createIntelligenceCivilization,
  fetchBhudhiCivilizations as fetchIntelligenceCivilizations,
} from "@/lib/bhudhi-civilization-api";
export {
  fetchKernelContext,
  fetchKernelEvents,
  runBhudhiKernelCycle as runIntelligenceKernelCycle,
} from "@/lib/bhudhi-kernel-api";
