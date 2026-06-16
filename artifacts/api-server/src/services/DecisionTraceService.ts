/**
 * Phase 5 / DOC 23 — audit trail facade (re-exports engines/decision).
 */

import {
  DecisionTraceService,
  writeEngineDecision,
  DOC23_DECISION_TYPES,
  type DecisionTraceWriteInput,
} from "../engines/decision/DecisionTraceService.js";
import {
  scoreCognitiveLoad,
  evaluateAndPersistCognitiveLoad,
} from "../engines/decision/CognitiveLoadScorer.js";
import { getBlueprintStateVersion } from "../engines/decision-trace/DecisionTraceSystem.js";

export {
  DecisionTraceService,
  writeEngineDecision,
  DOC23_DECISION_TYPES,
  type DecisionTraceWriteInput,
  scoreCognitiveLoad,
  evaluateAndPersistCognitiveLoad,
};

export { IL4_DECISION_TYPES } from "../engines/decision-trace/DecisionTraceSystem.js";

export const DECISION_TRACE_TYPES = {
  TASK_GENERATION: "SYSTEM_GENERATION",
  CONDITION_CHANGE: "SYSTEM_CONTROL",
  ENFORCEMENT_UPDATE: "SYSTEM_CONTROL",
  FAILURE_CLASSIFICATION: "SYSTEM_CORRECTION",
  PATTERN_DETECTION: "SYSTEM_CORRECTION",
  OUTCOME_VALIDATION: "SYSTEM_CORRECTION",
  IDENTITY_CHANGE: "SYSTEM_CONTROL",
  PRIORITY_SELECTION: "SYSTEM_CONTROL",
  CONTROL_OUTPUT: "SYSTEM_CONTROL",
  FAILURE_ROUTING: "SYSTEM_CORRECTION",
  USER_STRATEGIC: "USER_STRATEGIC",
  USER_EXECUTION: "USER_EXECUTION",
  AI_ASSISTED: "AI_ASSISTED",
  ADMIN_REPAIR: "ADMIN_REPAIR",
} as const;

export type DecisionTraceType = (typeof DECISION_TRACE_TYPES)[keyof typeof DECISION_TRACE_TYPES];

export interface DecisionTraceData {
  id?: string;
  userId: string;
  blueprintId?: string;
  decisionType: DecisionTraceType;
  sourceEngine: string;
  inputsSummary: Record<string, unknown>;
  reasoningChain: Array<{ step: string; result: string }>;
  outputAction: string;
  confidence: number;
  stateVersion: number;
  causationEventId?: string;
  createdAt?: Date;
}

const DIFFICULTY_LOAD_FACTOR: Record<string, number> = {
  very_easy: 1.0,
  easy: 1.0,
  moderate: 1.5,
  hard: 2.0,
  very_hard: 3.0,
};

/** DOC 23 — cognitive load on enforcement package (0–100). */
export function computeEnforcementCognitiveLoadScore(params: {
  activeOrderCount: number;
  taskMax: number;
  difficultyCap: string;
}): number {
  const difficultyFactor = DIFFICULTY_LOAD_FACTOR[params.difficultyCap] ?? 1.5;
  const raw =
    (params.activeOrderCount / Math.max(params.taskMax, 1)) * difficultyFactor * 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

function confidenceLabel(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 0.8) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  return "LOW";
}

export async function recordDecisionTrace(data: DecisionTraceData): Promise<string> {
  const rationale = data.reasoningChain.map((s) => `${s.step}: ${s.result}`).join(" | ");
  return DecisionTraceService.write({
    userId: data.userId,
    blueprintId: data.blueprintId ?? "",
    decisionType: data.decisionType as DecisionTraceWriteInput["decisionType"],
    decisionKey: `${data.decisionType}:${data.causationEventId ?? data.userId}`,
    selectedOption: data.outputAction,
    optionsConsidered: data.reasoningChain.map((s) => s.result),
    rationaleSummary: rationale || data.outputAction,
    sourceEngine: data.sourceEngine,
    confidence: confidenceLabel(data.confidence),
    stateVersion: data.stateVersion,
    causationEventId: data.causationEventId,
    evidenceIds: [],
  });
}

export async function traceTaskGenerationMode(params: {
  blueprintId: string;
  userId: string;
  generationMode: string;
  generationTrigger: string;
  selectedTaskType: string;
  candidatesConsidered: string[];
  causationEventId?: string;
}): Promise<string> {
  const stateVersion = await getBlueprintStateVersion(params.blueprintId);
  return DecisionTraceService.write({
    userId: params.userId,
    blueprintId: params.blueprintId,
    decisionType: "SYSTEM_GENERATION",
    decisionKey: `task_generation:${params.blueprintId}:${params.generationTrigger}`,
    selectedOption: params.selectedTaskType,
    optionsConsidered: params.candidatesConsidered,
    rationaleSummary: `Mode ${params.generationMode} via ${params.generationTrigger}`,
    sourceEngine: "TaskGenerationEngine",
    confidence: "HIGH",
    stateVersion,
    causationEventId: params.causationEventId,
  });
}

export async function traceConditionEvaluation(params: {
  blueprintId: string;
  userId: string;
  previousCondition: string;
  newCondition: string;
  escalationLevel: number;
  recoveryRequired: boolean;
  causationEventId?: string;
}): Promise<string> {
  const stateVersion = await getBlueprintStateVersion(params.blueprintId);
  return DecisionTraceService.write({
    userId: params.userId,
    blueprintId: params.blueprintId,
    decisionType: "SYSTEM_CONTROL",
    decisionKey: `condition_change:${params.blueprintId}`,
    selectedOption: params.newCondition,
    optionsConsidered: [params.previousCondition, params.newCondition],
    rejectedOptions: params.previousCondition !== params.newCondition ? [params.previousCondition] : [],
    rationaleSummary: `Condition ${params.previousCondition} → ${params.newCondition}`,
    sourceEngine: "ConditionEvaluationEngine",
    confidence: "HIGH",
    stateVersion,
    causationEventId: params.causationEventId,
  });
}

export {
  traceControlOutput,
  traceFailureRouting,
  tracePrioritySelection,
  getBlueprintStateVersion,
} from "../engines/decision-trace/DecisionTraceSystem.js";
