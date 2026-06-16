import {
  db,
  decisionTraces,
  blueprints,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export const IL4_DECISION_TYPES = {
  CONTROL_OUTPUT: "CONTROL_OUTPUT",
  FAILURE_ROUTING: "FAILURE_ROUTING",
  PRIORITY_SELECTION: "PRIORITY_SELECTION",
  CONDITION_CHANGE: "CONDITION_CHANGE",
} as const;

export async function traceDecision(params: {
  blueprintId: string;
  userId: string;
  decisionType: string;
  contextType: string;
  contextId?: string;
  rationale: string;
  outcome: string;
  evidenceIds?: string[];
  alternatives?: string[];
  aiAssisted?: boolean;
  engineSource?: string;
  inputSummary?: string;
  outputSummary?: string;
  alternativesConsidered?: unknown[];
  stateVersion?: number;
}): Promise<string> {
  const [row] = await db
    .insert(decisionTraces)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      decision_type: params.decisionType,
      entity_type: params.contextType,
      entity_id: params.contextId,
      reasoning: params.rationale,
      engine: params.engineSource ?? "decision_trace_system",
      engine_source: params.engineSource ?? "decision_trace_system",
      input_summary: params.inputSummary,
      output_summary: params.outputSummary,
      alternatives_considered: params.alternativesConsidered ?? params.alternatives ?? [],
      state_version: params.stateVersion,
      inputs_json: {
        user_id: params.userId,
        evidence_ids: params.evidenceIds ?? [],
        alternatives: params.alternatives ?? [],
        ai_assisted: params.aiAssisted ?? false,
        input_summary: params.inputSummary,
      },
      outputs_json: { outcome: params.outcome, output_summary: params.outputSummary },
    })
    .returning({ id: decisionTraces.id });

  if (!row) throw new Error("Failed to write decision trace");

  logger.debug(
    { traceId: row.id, decisionType: params.decisionType, blueprintId: params.blueprintId },
    "[DecisionTrace] Recorded",
  );

  return row.id;
}

/** IL4 LAW 1 — immutable audit after ControlEngine enforcement package. */
export async function traceControlOutput(params: {
  blueprintId: string;
  userId: string;
  packageId: string;
  condition: string;
  signalMomentum?: number | null;
  taskMin: number;
  taskMax: number;
  difficultyCap: string;
  stateVersion?: number;
}): Promise<string> {
  const momentum = params.signalMomentum ?? 0;
  return traceDecision({
    blueprintId: params.blueprintId,
    userId: params.userId,
    decisionType: IL4_DECISION_TYPES.CONTROL_OUTPUT,
    contextType: "enforcement_package",
    contextId: params.packageId,
    engineSource: "ControlEngine",
    inputSummary: `Condition: ${params.condition}. Signal momentum: ${momentum}.`,
    outputSummary: `task_limit: ${params.taskMin}-${params.taskMax}, difficulty_cap: ${params.difficultyCap}.`,
    rationale: `Condition ${params.condition} determines allowed behavior.`,
    outcome: `package:${params.packageId}`,
    stateVersion: params.stateVersion,
  }).then(async (traceId) => {
    const { DecisionTraceService } = await import("../decision/DecisionTraceService.js");
    await DecisionTraceService.write({
      userId: params.userId,
      blueprintId: params.blueprintId,
      decisionType: "SYSTEM_CONTROL",
      decisionKey: `enforcement_package:${params.packageId}`,
      selectedOption: `task_limit:${params.taskMin}-${params.taskMax}`,
      optionsConsidered: [
        `condition:${params.condition}`,
        `difficulty_cap:${params.difficultyCap}`,
      ],
      rationaleSummary: `Enforcement package restricts tasks to ${params.taskMin}-${params.taskMax} at ${params.difficultyCap}.`,
      sourceEngine: "ControlEngine",
      confidence: "HIGH",
      stateVersion: params.stateVersion,
      causationEventId: params.packageId,
    }).catch(() => null);
    return traceId;
  });
}

export async function traceFailureRouting(params: {
  blueprintId: string;
  userId: string;
  feedbackId: string;
  primaryCategory: string;
  correctionTaskType: string;
  stateVersion?: number;
}): Promise<string> {
  return traceDecision({
    blueprintId: params.blueprintId,
    userId: params.userId,
    decisionType: IL4_DECISION_TYPES.FAILURE_ROUTING,
    contextType: "feedback",
    contextId: params.feedbackId,
    engineSource: "FailureClassificationEngine",
    inputSummary: `feedback:${params.feedbackId}`,
    outputSummary: `classification:${params.primaryCategory}, correction:${params.correctionTaskType}`,
    rationale: `${params.primaryCategory} routed to ${params.correctionTaskType}`,
    outcome: params.correctionTaskType,
    stateVersion: params.stateVersion,
  });
}

export async function tracePrioritySelection(params: {
  blueprintId: string;
  userId: string;
  condition: string;
  selectedTaskType: string;
  selectedOrderId?: string;
  candidates: Array<{ task_type: string; score: number }>;
  stateVersion?: number;
}): Promise<string> {
  const alts = params.candidates.map((c) => `${c.task_type}:${c.score}`);
  return traceDecision({
    blueprintId: params.blueprintId,
    userId: params.userId,
    decisionType: IL4_DECISION_TYPES.PRIORITY_SELECTION,
    contextType: "order",
    contextId: params.selectedOrderId,
    engineSource: "PriorityEngine",
    inputSummary: `condition:${params.condition}, candidates:${params.candidates.length}`,
    outputSummary: `selected:${params.selectedTaskType}`,
    rationale: `Highest value score under condition ${params.condition}`,
    outcome: params.selectedTaskType,
    alternativesConsidered: params.candidates,
    alternatives: alts,
    stateVersion: params.stateVersion,
  });
}

export async function calculateCognitiveLoad(params: {
  blueprintId: string;
  userId: string;
}): Promise<{ loadScore: number; loadLevel: string; loadCategory: string }> {
  const { evaluateAndPersistCognitiveLoad } = await import("../decision/CognitiveLoadScorer.js");
  const assessment = await evaluateAndPersistCognitiveLoad(params);

  const loadCategory =
    assessment.level === "CRITICAL" ? "OVERLOAD"
    : assessment.level === "HIGH" ? "HIGH"
    : assessment.level === "MEDIUM" ? "MODERATE"
    : "LOW";

  return {
    loadScore: assessment.score / 100,
    loadLevel: assessment.level,
    loadCategory,
  };
}

export async function getBlueprintStateVersion(blueprintId: string): Promise<number> {
  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return bp?.state_version ?? 0;
}
