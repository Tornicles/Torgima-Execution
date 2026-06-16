import type { EvidenceRecord } from "../../services/erector/evidence/types.js";
import {
  evaluateArchetypePatterns,
  loadArchetypeFalseProgressPatterns,
  type ArchetypePatternContext,
  type ArchetypePatternRow,
} from "./EconomicFalseProgressPatternLibrary.js";

export type FalseProgressFlagType =
  | "ACTIVITY_WITHOUT_OUTCOME"
  | "PROOF_WEAK"
  | "METRIC_NOT_MOVING"
  | "WRONG_WORK"
  | "VANITY_PROGRESS"
  | "REPEATED_COMPLETION_NO_RESULT"
  | "CLAIM_CONTRADICTED";

export type PatternSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TriggeredPattern {
  pattern_id: string;
  pattern_name: string;
  archetype: string | "global";
  detection_evidence: string;
  severity: PatternSeverity;
  response_action: string;
}

export interface FalseProgressDetectionInput {
  blueprintId: string;
  archetype?: string | null;
  tasksCompleted7Days: number;
  blueprintActiveDays: number;
  evidenceScore: number;
  outcomeMovementScore: number;
  outcomeMovementSignal: number;
  alignmentScore: number;
  claimedOutcome: boolean;
  hasProof: boolean;
  avgScore: number;
  wrongWork: boolean;
  vanityMetricUntied: boolean;
  repeatedLowScoreCompletions: number;
  consecutiveLowMovementValidations: number;
  ledgerEvidence: EvidenceRecord[];
  archetypeContext?: ArchetypePatternContext;
  priorPatternCounts?: Record<string, number>;
  archetypePatterns?: ArchetypePatternRow[];
}

export interface FalseProgressDetectionResult {
  false_progress_detected: boolean;
  false_progress_score: number;
  patterns_triggered: TriggeredPattern[];
  flag_type: FalseProgressFlagType | string | null;
  should_create_flag: boolean;
  correction_type: string | null;
  checked_pattern_ids: string[];
}

const GLOBAL_SEVERITY_POINTS: Record<PatternSeverity, number> = {
  LOW: 8,
  MEDIUM: 15,
  HIGH: 25,
  CRITICAL: 40,
};

const ARCHETYPE_SEVERITY_POINTS: Record<Exclude<PatternSeverity, "CRITICAL">, number> = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: 30,
};

const CORRECTION_BY_PATTERN: Record<string, string> = {
  ACTIVITY_WITHOUT_OUTCOME: "refocus_task",
  PROOF_WEAK: "evidence_submission",
  METRIC_NOT_MOVING: "root_cause",
  WRONG_WORK: "refocus_task",
  VANITY_PROGRESS: "clarification_task",
  REPEATED_COMPLETION_NO_RESULT: "task_value_review",
  CLAIM_CONTRADICTED: "reality_check",
};

function pushGlobalPattern(
  patterns: TriggeredPattern[],
  pattern: Omit<TriggeredPattern, "archetype">,
): void {
  patterns.push({ ...pattern, archetype: "global" });
}

export function detectGlobalFalseProgressPatterns(
  input: FalseProgressDetectionInput,
): TriggeredPattern[] {
  const patterns: TriggeredPattern[] = [];

  if (input.tasksCompleted7Days > 5 && input.outcomeMovementSignal < 20) {
    pushGlobalPattern(patterns, {
      pattern_id: "ACTIVITY_WITHOUT_OUTCOME",
      pattern_name: "Activity Without Outcome",
      detection_evidence: `${input.tasksCompleted7Days} tasks completed with outcome movement ${input.outcomeMovementSignal}`,
      severity: input.blueprintActiveDays > 14 ? "HIGH" : "MEDIUM",
      response_action: "Review if your tasks are moving the target metric",
    });
  }

  if (input.evidenceScore < 30 && input.claimedOutcome) {
    pushGlobalPattern(patterns, {
      pattern_id: "PROOF_WEAK",
      pattern_name: "Proof Weak",
      detection_evidence: `Evidence score ${input.evidenceScore} with claimed outcome`,
      severity: "HIGH",
      response_action: "Submit specific proof for the target",
    });
  }

  if (input.consecutiveLowMovementValidations >= 3) {
    pushGlobalPattern(patterns, {
      pattern_id: "METRIC_NOT_MOVING",
      pattern_name: "Metric Not Moving",
      detection_evidence: `${input.consecutiveLowMovementValidations} consecutive validations below movement threshold`,
      severity: "HIGH",
      response_action: "Diagnose why the target metric is not moving",
    });
  }

  if (input.wrongWork) {
    pushGlobalPattern(patterns, {
      pattern_id: "WRONG_WORK",
      pattern_name: "Wrong Work",
      detection_evidence: "Recent tasks are not aligned to the current target or phase",
      severity: "MEDIUM",
      response_action: "Return focus to the current target",
    });
  }

  if (input.vanityMetricUntied) {
    pushGlobalPattern(patterns, {
      pattern_id: "VANITY_PROGRESS",
      pattern_name: "Vanity Progress",
      detection_evidence: "Positive metric is not tied to the target metric",
      severity: "MEDIUM",
      response_action: "Confirm whether the vanity metric supports the target",
    });
  }

  if (input.repeatedLowScoreCompletions >= 3 && input.outcomeMovementScore < 20) {
    pushGlobalPattern(patterns, {
      pattern_id: "REPEATED_COMPLETION_NO_RESULT",
      pattern_name: "Repeated Completion No Result",
      detection_evidence: `${input.repeatedLowScoreCompletions} low-score repeats without movement`,
      severity: "HIGH",
      response_action: "Review whether repeated task type is producing outcomes",
    });
  }

  const contradictedLedger = input.ledgerEvidence.some(
    (row) => row.contradiction_status === "confirmed",
  );
  if (contradictedLedger) {
    pushGlobalPattern(patterns, {
      pattern_id: "CLAIM_CONTRADICTED",
      pattern_name: "Claim Contradicted",
      detection_evidence: "Evidence ledger contains confirmed contradiction",
      severity: "CRITICAL",
      response_action: "Review and correct your progress claim",
    });
  }

  return patterns;
}

export function calculateFalseProgressScore(
  patterns: TriggeredPattern[],
  priorPatternCounts: Record<string, number> = {},
): number {
  let score = 0;

  for (const pattern of patterns) {
    const isGlobal = pattern.archetype === "global";
    const basePoints = isGlobal
      ? GLOBAL_SEVERITY_POINTS[pattern.severity]
      : ARCHETYPE_SEVERITY_POINTS[
          pattern.severity === "CRITICAL" ? "HIGH" : pattern.severity
        ];

    const priorCount = priorPatternCounts[pattern.pattern_id] ?? 0;
    const multiplier =
      priorCount >= 3 ? 2.0 : priorCount >= 2 ? 1.5 : 1.0;

    score += Math.round(basePoints * multiplier);
  }

  return Math.min(100, score);
}

function severityFromScore(score: number): PatternSeverity {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  if (score >= 30) return "LOW";
  return "LOW";
}

export async function runFalseProgressDetection(
  input: FalseProgressDetectionInput,
): Promise<FalseProgressDetectionResult> {
  const globalPatterns = detectGlobalFalseProgressPatterns(input);

  const archetypePatterns =
    input.archetypePatterns ??
    (input.archetype
      ? await loadArchetypeFalseProgressPatterns(input.archetype)
      : []);

  const archetypeTriggered = evaluateArchetypePatterns(
    archetypePatterns,
    input.archetypeContext ?? {},
  ).map((pattern) => ({
    ...pattern,
    archetype: pattern.archetype,
  }));

  const patternsTriggered = [...globalPatterns, ...archetypeTriggered];
  const falseProgressScore = calculateFalseProgressScore(
    patternsTriggered,
    input.priorPatternCounts,
  );

  const hasCritical = patternsTriggered.some((pattern) => pattern.severity === "CRITICAL");
  const shouldCreateFlag = hasCritical || falseProgressScore >= 30;
  const primaryPattern = patternsTriggered[0] ?? null;

  return {
    false_progress_detected: patternsTriggered.length > 0,
    false_progress_score: falseProgressScore,
    patterns_triggered: patternsTriggered,
    flag_type: primaryPattern?.pattern_id ?? null,
    should_create_flag: shouldCreateFlag,
    correction_type: primaryPattern
      ? (CORRECTION_BY_PATTERN[primaryPattern.pattern_id] ??
        primaryPattern.response_action)
      : null,
    checked_pattern_ids: [
      ...globalPatterns.map((pattern) => pattern.pattern_id),
      ...archetypePatterns.map((pattern) => pattern.pattern_id),
    ],
  };
}

export function mapScoreToFlagSeverity(score: number): PatternSeverity {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export { severityFromScore };
