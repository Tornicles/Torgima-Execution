import type { BhudhiOutputEnvelope, BhudhiOutputType } from "../types/bhudhi.js";
import { logger } from "../lib/logger.js";
import { getContractByName, PromptRegistry } from "./PromptRegistry.js";

export interface ValidationResult {
  ok:     boolean;
  errors: string[];
}

const VALID_CONFIDENCE  = ["LOW", "MEDIUM", "HIGH"];
const VALID_BLOCKER_CAT = ["MISSING_INFORMATION", "DEPENDENCY_BLOCKED", "TOO_DIFFICULT", "TIME_CONSTRAINT", "ENERGY_CONSTRAINT", "EXTERNAL_WAIT", "UNCLEAR_TASK", "OTHER"];
const VALID_SEVERITY    = ["LOW", "MEDIUM", "HIGH"];
const VALID_TONES       = ["CALM", "DIRECT", "RECOVERY", "FOCUSED", "WARM"];
const VALID_TASK_TONE   = ["CALM", "WARM", "DIRECT"];
const VALID_ANSWER_TYPE = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "CHOICE"];
const VALID_REC         = ["ENOUGH_TO_REVIEW", "NEEDS_MORE_EVIDENCE", "UNCLEAR"];
const VALID_ROOT_CAT    = ["CLARITY", "CAPABILITY", "CAPACITY", "DEPENDENCY", "MOTIVATION", "SYSTEM_FRICTION", "EXTERNAL"];
const VALID_EFFORT      = ["SMALL", "MEDIUM", "LARGE"];
const VALID_COMMITMENT  = ["LOW", "MEDIUM", "HIGH", "INTENSE", "FULL"];

export function validateOutput(raw: unknown, expectedType: BhudhiOutputType, expectedStateVersion: number): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["Output is not an object"] };
  }

  const envelope = raw as BhudhiOutputEnvelope;

  if (!envelope.outputType)      errors.push("Missing outputType");
  if (envelope.outputType && envelope.outputType !== expectedType) {
    errors.push(`outputType mismatch: ${envelope.outputType} vs expected ${expectedType}`);
  }
  if (!envelope.contractVersion) errors.push("Missing contractVersion");
  if (envelope.stateVersion === undefined) errors.push("Missing stateVersion");
  if (!VALID_CONFIDENCE.includes(envelope.confidence)) errors.push(`Invalid confidence: ${String(envelope.confidence)}`);
  if (typeof envelope.forbiddenActionRequested !== "boolean") errors.push("Missing forbiddenActionRequested");

  if (envelope.forbiddenActionRequested === true) {
    errors.push("FORBIDDEN: Output requested a forbidden action");
  }

  if (expectedStateVersion > 0 && envelope.stateVersion !== expectedStateVersion) {
    errors.push(
      `Bhudhi output is stale — state has changed since call (output version ${String(envelope.stateVersion)}, expected ${expectedStateVersion})`,
    );
  }

  if (!envelope.data || typeof envelope.data !== "object") {
    return { ok: false, errors: [...errors, "Missing data object"] };
  }

  const d = envelope.data as Record<string, unknown>;

  switch (expectedType) {
    case "task_copy": {
      const hasCommand = typeof d["command"] === "string" && String(d["command"]).trim().length > 0;
      if (hasCommand) {
        if (!d["requiredOutput"]) errors.push("task_copy: command mode missing requiredOutput");
        if (!d["doneCriteria"]) errors.push("task_copy: command mode missing doneCriteria");
        if (!d["proof"]) errors.push("task_copy: command mode missing proof");
        if (!d["where"]) errors.push("task_copy: command mode missing where");
        if (!d["how"]) errors.push("task_copy: command mode missing how");
        if (!d["unlockConsequence"]) errors.push("task_copy: command mode missing unlockConsequence");
        if (typeof d["title"] === "string" && d["title"].length > 120) errors.push("task_copy: title too long");
        if (typeof d["command"] === "string" && d["command"].length > 1200) errors.push("task_copy: command too long");
        break;
      }
      if (!d["title"]) errors.push("task_copy: missing title");
      if (!d["instruction"]) errors.push("task_copy: missing instruction");
      if (!d["successCriteria"]) errors.push("task_copy: missing successCriteria");
      if (typeof d["title"] === "string" && d["title"].length > 120) errors.push("task_copy: title too long");
      if (typeof d["instruction"] === "string" && d["instruction"].length > 900) errors.push("task_copy: instruction too long");
      if (!VALID_EFFORT.includes(d["estimatedEffortLabel"] as string)) errors.push("task_copy: invalid estimatedEffortLabel");
      break;
    }

    case "blocker_classification":
      if (!VALID_BLOCKER_CAT.includes(d["blockerCategory"] as string)) errors.push("blocker: invalid blockerCategory");
      if (!VALID_SEVERITY.includes(d["severity"] as string))           errors.push("blocker: invalid severity");
      if (!d["summary"])                                                errors.push("blocker: missing summary");
      break;

    case "state_explanation":
      if (!d["headline"])           errors.push("state: missing headline");
      if (!d["explanation"])        errors.push("state: missing explanation");
      if (!d["nextActionReason"])   errors.push("state: missing nextActionReason");
      if (!VALID_TONES.includes(d["displayTone"] as string)) errors.push("state: invalid displayTone");
      if (typeof d["headline"] === "string" && d["headline"].length > 80) errors.push("state: headline too long");
      if (typeof d["explanation"] === "string" && d["explanation"].length > 220) errors.push("state: explanation too long");
      break;

    case "clarification_request":
      if (!d["question"])      errors.push("clarification: missing question");
      if (!d["requiredField"]) errors.push("clarification: missing requiredField");
      if (!VALID_ANSWER_TYPE.includes(d["answerType"] as string)) errors.push("clarification: invalid answerType");
      if (d["answerType"] === "CHOICE" && (!Array.isArray(d["choices"]) || (d["choices"] as unknown[]).length < 1)) {
        errors.push("clarification: CHOICE requires non-empty choices");
      }
      break;

    case "evidence_summary":
      if (!d["submittedEvidenceSummary"]) errors.push("evidence: missing summary");
      if (!VALID_REC.includes(d["validationRecommendation"] as string)) errors.push("evidence: invalid validationRecommendation");
      break;

    case "root_cause_candidates":
      if (!Array.isArray(d["candidates"])) errors.push("root_cause: candidates must be array");
      else {
        (d["candidates"] as { category?: string; likelihood?: string }[]).forEach((c, i) => {
          if (!VALID_ROOT_CAT.includes(c.category ?? "")) errors.push(`root_cause: invalid category at index ${i}`);
          if (!VALID_SEVERITY.includes(c.likelihood ?? "")) errors.push(`root_cause: invalid likelihood at index ${i}`);
        });
      }
      if (!d["recommendedNextDiagnosticQuestion"]) errors.push("root_cause: missing recommendedNextDiagnosticQuestion");
      break;

    case "structured_goal":
      if (!d["cleanedGoal"]) errors.push("structured_goal: missing cleanedGoal");
      if (d["commitmentLevel"]) {
        const cl = String(d["commitmentLevel"]).toUpperCase();
        if (!VALID_COMMITMENT.includes(cl)) errors.push("structured_goal: invalid commitmentLevel");
      }
      break;

    case "reality_intelligence": {
      const momentum = ["growing", "declining", "emerging", "oversaturated", "behavior_shifting"];
      if (!momentum.includes(String(d["marketMomentum"]))) {
        errors.push("reality_intelligence: invalid marketMomentum");
      }
      const dc = String(d["demandConfidence"] ?? "").toLowerCase();
      if (!["high", "medium", "low"].includes(dc)) errors.push("reality_intelligence: invalid demandConfidence");
      if (!d["trendExplanation"]) errors.push("reality_intelligence: missing trendExplanation");

      const concepts = Array.isArray(d["similarConcepts"])
        ? d["similarConcepts"]
        : d["similarCompanies"];
      if (!Array.isArray(concepts)) errors.push("reality_intelligence: missing similarConcepts / similarCompanies");
      else if (concepts.length < 1) errors.push("reality_intelligence: similarConcepts must be non-empty");

      const pos = d["positioning"] as Record<string, unknown> | undefined;
      if (!pos || typeof pos !== "object") errors.push("reality_intelligence: missing positioning");
      else {
        if (!pos["strongestAngle"]) errors.push("reality_intelligence: positioning.strongestAngle");
        if (!pos["weakestAngle"]) errors.push("reality_intelligence: positioning.weakestAngle");
        if (!pos["userMisconception"]) errors.push("reality_intelligence: positioning.userMisconception");
        const diffPath = pos["differentiationPath"] ?? pos["differentiationOpportunity"];
        if (!diffPath) errors.push("reality_intelligence: positioning.differentiationPath");
        if (!pos["positioningRule"]) errors.push("reality_intelligence: positioning.positioningRule");
      }
      const ws = d["whiteSpace"] as Record<string, unknown> | undefined;
      if (!ws || typeof ws !== "object") errors.push("reality_intelligence: missing whiteSpace");
      else {
        for (const k of ["underservedUsers", "emotionalGaps", "executionGaps", "unclaimedPositioning", "competitorWeaknesses"]) {
          if (!Array.isArray(ws[k])) errors.push(`reality_intelligence: whiteSpace.${k} must be array`);
        }
        if (!ws["opportunityPath"]) errors.push("reality_intelligence: whiteSpace.opportunityPath");
      }
      const ta = d["timingAnalysis"] as Record<string, unknown> | undefined;
      if (!ta || typeof ta !== "object") errors.push("reality_intelligence: missing timingAnalysis");
      else {
        if (!ta["risk"]) errors.push("reality_intelligence: timingAnalysis.risk");
        if (!ta["opportunity"]) errors.push("reality_intelligence: timingAnalysis.opportunity");
        const urg = String(ta["urgency"] ?? "");
        if (!["immediate", "moderate", "patient"].includes(urg)) errors.push("reality_intelligence: timingAnalysis.urgency");
        if (!ta["reason"]) errors.push("reality_intelligence: timingAnalysis.reason");
      }
      if (!Array.isArray(d["strategicWarnings"])) errors.push("reality_intelligence: strategicWarnings must be array");
      const seed = d["blueprintSeedInstructions"] ?? d["blueprintSeedingInstructions"];
      if (!seed) errors.push("reality_intelligence: missing blueprintSeedInstructions");
      if (!d["executionImplication"]) errors.push("reality_intelligence: missing executionImplication");
      break;
    }

    case "recovery_copy":
      if (!d["title"]) errors.push("recovery_copy: missing title");
      if (!d["instruction"]) errors.push("recovery_copy: missing instruction");
      if (!d["expectedOutput"]) errors.push("recovery_copy: missing expectedOutput");
      if (!VALID_TASK_TONE.includes(d["tone"] as string)) errors.push("recovery_copy: invalid tone");
      break;

    case "restart_copy":
      if (!d["title"]) errors.push("restart_copy: missing title");
      if (!d["instruction"]) errors.push("restart_copy: missing instruction");
      if (!d["welcomeMessage"]) errors.push("restart_copy: missing welcomeMessage");
      break;

    case "academy_instruction":
      if (!d["title"]) errors.push("academy_instruction: missing title");
      if (!d["instruction"]) errors.push("academy_instruction: missing instruction");
      if (!d["practiceTask"]) errors.push("academy_instruction: missing practiceTask");
      if (!d["proofOfUnderstanding"]) errors.push("academy_instruction: missing proofOfUnderstanding");
      break;

    case "academy_skill_assessment":
      if (typeof d["masteryScore"] !== "number") errors.push("academy_skill_assessment: missing masteryScore");
      if (!d["evidenceAnalysis"]) errors.push("academy_skill_assessment: missing evidenceAnalysis");
      break;

    case "academy_gap_severity":
      if (!d["severity"]) errors.push("academy_gap_severity: missing severity");
      if (!d["evidenceSummary"]) errors.push("academy_gap_severity: missing evidenceSummary");
      break;

    case "blueprint_health":
      if (typeof d["healthScore"] !== "number") errors.push("blueprint_health: missing healthScore");
      if (!d["agentAssessment"]) errors.push("blueprint_health: missing agentAssessment");
      if (!Array.isArray(d["gapsDetected"])) errors.push("blueprint_health: gapsDetected must be array");
      break;

    case "execution_help":
      if (!Array.isArray(d["steps"]) || (d["steps"] as unknown[]).length === 0) {
        errors.push("execution_help: missing steps");
      }
      if (!Array.isArray(d["toolList"])) errors.push("execution_help: missing toolList");
      if (!d["exampleOutput"]) errors.push("execution_help: missing exampleOutput");
      break;

    case "blueprint_interpretation":
      if (!d["interpretation"]) errors.push("blueprint_interpretation: missing interpretation");
      if (!d["currentFocus"]) errors.push("blueprint_interpretation: missing currentFocus");
      if (!d["nextMilestone"]) errors.push("blueprint_interpretation: missing nextMilestone");
      if (typeof d["interpretation"] === "string" && d["interpretation"].length > 800) {
        errors.push("blueprint_interpretation: interpretation too long");
      }
      break;

    case "eis_competitor":
      if (!Array.isArray(d["competitors"])) errors.push("eis_competitor: competitors must be array");
      if (!d["threatLevel"]) errors.push("eis_competitor: missing threatLevel");
      if (!Array.isArray(d["opportunityGaps"])) errors.push("eis_competitor: opportunityGaps must be array");
      if (!d["keyLesson"]) errors.push("eis_competitor: missing keyLesson");
      break;

    case "eis_narrative":
      if (!d["dominantNarrative"]) errors.push("eis_narrative: missing dominantNarrative");
      if (!Array.isArray(d["emergingNarratives"])) errors.push("eis_narrative: emergingNarratives must be array");
      if (!d["sentimentSignal"]) errors.push("eis_narrative: missing sentimentSignal");
      if (!d["bestContentAngle"]) errors.push("eis_narrative: missing bestContentAngle");
      break;

    case "eis_opportunity_synthesis":
      if (!Array.isArray(d["opportunities"])) errors.push("eis_opportunity_synthesis: opportunities must be array");
      if (!d["topOpportunity"]) errors.push("eis_opportunity_synthesis: missing topOpportunity");
      if (!d["alignmentWithBlueprint"]) errors.push("eis_opportunity_synthesis: missing alignmentWithBlueprint");
      break;

    case "eis_synthesis":
      if (!Array.isArray(d["trendingTopics"])) errors.push("eis_synthesis: trendingTopics must be array");
      if (!Array.isArray(d["platformSignals"])) errors.push("eis_synthesis: platformSignals must be array");
      if (!Array.isArray(d["opportunities"])) errors.push("eis_synthesis: opportunities must be array");
      if (!d["todayRecommendation"]) errors.push("eis_synthesis: missing todayRecommendation");
      if (!Array.isArray(d["competitorInsights"])) errors.push("eis_synthesis: competitorInsights must be array");
      if (!Array.isArray(d["knowledgeUpdates"])) errors.push("eis_synthesis: knowledgeUpdates must be array");
      break;

    case "strategic_outlook":
      if (!d["executionForecast"]) errors.push("strategic_outlook: missing executionForecast");
      if (!Array.isArray(d["riskFactors"])) errors.push("strategic_outlook: riskFactors must be array");
      if (!d["highestLeverageAction"]) errors.push("strategic_outlook: missing highestLeverageAction");
      if (!d["confidenceTier"]) errors.push("strategic_outlook: missing confidenceTier");
      break;

    case "behavioral_insight":
      if (!d["insightType"]) errors.push("behavioral_insight: missing insightType");
      if (!d["insightText"]) errors.push("behavioral_insight: missing insightText");
      if (!d["evidenceSummary"]) errors.push("behavioral_insight: missing evidenceSummary");
      break;

    case "identity_update":
      if (!d["identityStage"]) errors.push("identity_update: missing identityStage");
      if (typeof d["confidenceDelta"] !== "number") errors.push("identity_update: missing confidenceDelta");
      if (typeof d["purposeAlignment"] !== "number") errors.push("identity_update: missing purposeAlignment");
      if (!d["keyInsight"]) errors.push("identity_update: missing keyInsight");
      if (typeof d["milestoneProximity"] !== "boolean") errors.push("identity_update: missing milestoneProximity");
      break;

    case "signal_narrative":
      if (!d["narrativeText"]) errors.push("signal_narrative: missing narrativeText");
      if (!d["keyTrend"]) errors.push("signal_narrative: missing keyTrend");
      if (!d["momentumStatus"]) errors.push("signal_narrative: missing momentumStatus");
      break;

    case "external_intelligence":
      if (!Array.isArray(d["marketTrends"])) errors.push("external_intelligence: marketTrends must be array");
      if (!Array.isArray(d["opportunitySignals"])) errors.push("external_intelligence: opportunitySignals must be array");
      if (!Array.isArray(d["riskSignals"])) errors.push("external_intelligence: riskSignals must be array");
      if (!Array.isArray(d["competitorMoves"])) errors.push("external_intelligence: competitorMoves must be array");
      if (!d["executionRecommendation"]) errors.push("external_intelligence: missing executionRecommendation");
      break;

    case "predictive_analysis":
      break;

    case "erector_archetype_narrative":
    case "erector_purpose":
    case "erector_industry":
    case "erector_market":
    case "validation_competitor_deep":
      if (!d["name"]) errors.push("validation_competitor_deep: missing name");
      if (!d["archetype"]) errors.push("validation_competitor_deep: missing archetype");
      break;
    case "validation_explanations":
      if (!d["reality_score"]) errors.push("validation_explanations: missing reality_score");
      if (!d["final_verdict"]) errors.push("validation_explanations: missing final_verdict");
      break;
    case "blueprint_tier_preview": {
      const td = d["tierDescriptions"];
      if (!td || typeof td !== "object") {
        errors.push("blueprint_tier_preview: missing tierDescriptions");
      }
      break;
    }
    case "erector_competitors":
    case "erector_economy":
    case "erector_pain":
    case "erector_time_simulation":
    case "erector_paths":
    case "erector_first_week":
      if (!d["summary"]) errors.push(`${expectedType}: missing summary`);
      if (!Array.isArray(d["warnings"])) errors.push(`${expectedType}: warnings must be array`);
      if (!Array.isArray(d["opportunities"])) errors.push(`${expectedType}: opportunities must be array`);
      break;

    default:
      errors.push(`Unknown output type: ${expectedType}`);
  }

  if (errors.length > 0) {
    logger.warn({ expectedType, errors }, "[OutputValidator] Validation failed");
    return { ok: false, errors };
  }

  return { ok: true, errors: [] };
}

function stripMarkdownJson(rawText: string): string {
  return rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
}

function resolveContract(contractName: string) {
  return getContractByName(contractName) ?? PromptRegistry.resolveByName(contractName);
}

/** B2 — validate raw model text against a named prompt contract's Zod schema. */
export function validateFromContract<T = unknown>(
  rawText: string,
  contractName: string,
): { ok: boolean; data?: T; errors?: string[] } {
  const contract = resolveContract(contractName);
  if (!contract) {
    return { ok: false, errors: [`Contract not found: ${contractName}`] };
  }

  const cleaned = stripMarkdownJson(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, errors: ["Not valid JSON"] };
  }

  if (contract.outputSchema) {
    const result = contract.outputSchema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        errors: result.error.issues.map((i) => i.message),
      };
    }
    return { ok: true, data: result.data as T };
  }

  const envelope = parsed as BhudhiOutputEnvelope;
  const legacy = validateOutput(parsed, contract.outputType, envelope.stateVersion ?? 0);
  return legacy.ok
    ? { ok: true, data: parsed as T }
    : { ok: false, errors: legacy.errors };
}

/** B2 spec alias. */
export const OutputValidator = {
  validate: validateFromContract,
  validateEnvelope: validateOutput,
};
