import type { BhudhiOutputEnvelope, BhudhiOutputType } from "../types/bhudhi.js";
import { logger } from "../lib/logger.js";

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

  if (Math.abs((envelope.stateVersion ?? 0) - expectedStateVersion) > 2) {
    errors.push(`Stale state: output version ${String(envelope.stateVersion)}, expected ${expectedStateVersion}`);
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

    default:
      errors.push(`Unknown output type: ${expectedType}`);
  }

  if (errors.length > 0) {
    logger.warn({ expectedType, errors }, "[OutputValidator] Validation failed");
    return { ok: false, errors };
  }

  return { ok: true, errors: [] };
}
