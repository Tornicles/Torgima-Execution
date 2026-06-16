import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

const RETENTION_ARCHETYPES = new Set([
  "saas_platform",
  "subscription_membership",
  "collective_community",
]);

export function calculateRetentionSignal(data: {
  archetype: string | null | undefined;
  retentionEvidenceCount: number;
  expectedRetentionCount: number;
  evidenceIds: string[];
}): SignalResult {
  if (!data.archetype || !RETENTION_ARCHETYPES.has(data.archetype)) {
    return {
      signal_type: "RETENTION_SIGNAL",
      value: 0,
      confidence: "LOW",
      source_evidence_ids: [],
      source_execution_data: { applicable: false, archetype: data.archetype ?? null },
      calculation_method: "not_applicable_for_archetype",
    };
  }

  const value = clampSignal(
    (data.retentionEvidenceCount / Math.max(1, data.expectedRetentionCount)) * 100,
  );
  return {
    signal_type: "RETENTION_SIGNAL",
    value,
    confidence: confidenceFromCoverage(
      data.retentionEvidenceCount / Math.max(1, data.expectedRetentionCount),
    ),
    source_evidence_ids: data.evidenceIds,
    source_execution_data: {
      retention_evidence_count: data.retentionEvidenceCount,
      expected_retention_count: data.expectedRetentionCount,
    },
    calculation_method: "count(retention_evidence) / expected_retention_count * 100",
  };
}
