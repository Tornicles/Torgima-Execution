/**
 * DOC25 Task 1 — classify 9 friction types from behavioral evidence.
 */

import {
  isHardOrAbove,
  reflectionMentionsUnclear,
  type FrictionEvidence,
} from "./FrictionEvidence.js";
import {
  CONFIDENCE_ORDER,
  SEVERITY_ORDER,
  type DetectedFriction,
  type Doc25FrictionType,
  type FrictionConfidence,
  type FrictionSeverity,
} from "./frictionTypes.js";

export class FrictionClassifier {
  static classify(evidence: FrictionEvidence): DetectedFriction[] {
    const detected: DetectedFriction[] = [];

    const clarity = detectClarityFriction(evidence);
    if (clarity) detected.push(clarity);

    const size = detectSizeFriction(evidence);
    if (size) detected.push(size);

    const difficulty = detectDifficultyFriction(evidence);
    if (difficulty) detected.push(difficulty);

    const timing = detectTimingFriction(evidence);
    if (timing) detected.push(timing);

    const dependency = detectDependencyFriction(evidence);
    if (dependency) detected.push(dependency);

    const cognitive = detectCognitiveFriction(evidence);
    if (cognitive) detected.push(cognitive);

    if (!difficulty) {
      const emotional = detectEmotionalFriction(evidence);
      if (emotional) detected.push(emotional);
    }

    const system = detectSystemFriction(evidence);
    if (system) detected.push(system);

    const outcome = detectOutcomeFriction(evidence);
    if (outcome) detected.push(outcome);

    return detected.sort(
      (a, b) =>
        SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
        CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence],
    );
  }

  static selectPrimary(detected: DetectedFriction[]): DetectedFriction | null {
    if (detected.length === 0) return null;
    return detected[0] ?? null;
  }
}

function detectClarityFriction(evidence: FrictionEvidence): DetectedFriction | null {
  const unclearReflection = reflectionMentionsUnclear(evidence.reflection);
  const missingProof =
    evidence.proofRequired &&
    !evidence.proofProvided &&
    (!evidence.proofDescription || evidence.proofDescription.trim().length === 0);

  if (!unclearReflection && !missingProof) return null;

  const severity: FrictionSeverity =
    evidence.consecutiveClarityCount >= 2 || unclearReflection ? "HIGH" : "MEDIUM";

  return friction("CLARITY_FRICTION", severity, "HIGH", "Task instructions or proof requirements were unclear");
}

function detectSizeFriction(evidence: FrictionEvidence): DetectedFriction | null {
  if (
    evidence.durationMinutes == null ||
    evidence.timeEstimateMinutes == null ||
    evidence.timeEstimateMinutes <= 0
  ) {
    return null;
  }

  const oversized = evidence.durationMinutes > evidence.timeEstimateMinutes * 2;
  const lowScore = (evidence.score ?? 10) < 7;
  if (!oversized || !lowScore) return null;

  return friction("SIZE_FRICTION", "MEDIUM", "HIGH", "Task took more than 2x estimated time with low score");
}

function detectDifficultyFriction(evidence: FrictionEvidence): DetectedFriction | null {
  if (evidence.capabilityFailureClassified) return null;
  if (!isHardOrAbove(evidence.difficulty)) return null;
  if ((evidence.score ?? 10) > 4) return null;

  return friction("DIFFICULTY_FRICTION", "HIGH", "HIGH", "Hard task scored poorly — difficulty mismatch");
}

function detectTimingFriction(evidence: FrictionEvidence): DetectedFriction | null {
  if (evidence.submittedHoursAfterStart == null || evidence.submittedHoursAfterStart <= 36) {
    return null;
  }
  if ((evidence.inactivityType ?? "").toUpperCase() === "LIFE_EVENT") return null;

  return friction("TIMING_FRICTION", "MEDIUM", "MEDIUM", "Task timing window exceeded 36 hours");
}

function detectDependencyFriction(evidence: FrictionEvidence): DetectedFriction | null {
  if (evidence.completionStatus !== "BLOCKED" || !evidence.dependencyBlocked) return null;

  return friction("DEPENDENCY_FRICTION", "HIGH", "HIGH", "Execution path blocked by dependency");
}

function detectCognitiveFriction(evidence: FrictionEvidence): DetectedFriction | null {
  if (!evidence.cognitiveLoadRecent) return null;
  const level = (evidence.cognitiveLoadLevel ?? "").toUpperCase();
  if (!["HIGH", "CRITICAL"].includes(level)) return null;

  return friction("COGNITIVE_FRICTION", "HIGH", "HIGH", "Recent cognitive load spike blocking execution");
}

function detectEmotionalFriction(evidence: FrictionEvidence): DetectedFriction | null {
  if (!evidence.reflectionToneNegative) return null;
  if ((evidence.score ?? 10) > 5) return null;

  return friction("EMOTIONAL_FRICTION", "MEDIUM", "MEDIUM", "Negative engagement signal without capability mismatch");
}

function detectSystemFriction(evidence: FrictionEvidence): DetectedFriction | null {
  if (!evidence.stateIntegrityIssueRecent || !evidence.reflectionMentionsSystem) return null;

  return friction("SYSTEM_FRICTION", "HIGH", "HIGH", "Product/system issue correlated with user reflection");
}

function detectOutcomeFriction(evidence: FrictionEvidence): DetectedFriction | null {
  if (!evidence.taskAccepted) return null;
  if (evidence.outcomeMovementScore >= 15) return null;
  if (evidence.falseProgressSignal <= 50) return null;

  return friction(
    "OUTCOME_FRICTION",
    "HIGH",
    "HIGH",
    "Accepted task did not move outcome needle despite false-progress signal",
  );
}

function friction(
  type: Doc25FrictionType,
  severity: FrictionSeverity,
  confidence: FrictionConfidence,
  reason: string,
): DetectedFriction {
  return { type, severity, confidence, reason };
}
