export type InterrogationDecision = {
  required: boolean;
  question?: string;
  validation_status: "accepted" | "needs_interrogation";
};

const QUESTIONS: Record<string, string> = {
  HIGH_SCORE_WEAK_REFLECTION:
    "Your score suggests strong execution but your description was brief. What specifically did you produce or accomplish? Describe the actual output.",
  COMPLETION_TOO_FAST:
    "This task was completed faster than expected. What approach did you use to finish quickly? What was the output?",
  FAILED_BUT_HIGH_SCORE:
    "You marked this as failed but gave a high score. What partial progress did you make? What prevented full completion?",
  PROOF_UNRELATED_TO_TASK:
    "The proof submitted does not clearly match this task. Can you describe how this proof demonstrates completion of this task?",
  DEFAULT:
    "Your reflection was brief. What was the actual outcome of this task? What did you produce, decide, or change?",
};

export function shouldTriggerInterrogation(params: {
  confidence_multiplier: number;
  flags: string[];
  trigger_interrogation: boolean;
}): boolean {
  if (params.trigger_interrogation) return true;
  if (params.confidence_multiplier < 0.7) return true;
  return params.flags.some((f) =>
    ["HIGH_SCORE_WEAK_REFLECTION", "PROOF_UNRELATED_TO_TASK", "COMPLETION_TOO_FAST"].includes(f),
  );
}

export function selectInterrogationQuestion(params: {
  flags: string[];
  taskTitle?: string | null;
}): string {
  const primary =
    params.flags.find((f) => QUESTIONS[f]) ??
    (params.flags.includes("COMPLETION_TOO_FAST") ? "COMPLETION_TOO_FAST" : undefined);

  if (primary === "PROOF_UNRELATED_TO_TASK" && params.taskTitle) {
    return `The proof submitted does not clearly match this task. Can you describe how this proof demonstrates completion of ${params.taskTitle}?`;
  }

  return QUESTIONS[primary ?? "DEFAULT"] ?? QUESTIONS.DEFAULT;
}

export function buildInterrogationDecision(params: {
  confidence_multiplier: number;
  flags: string[];
  trigger_interrogation: boolean;
  taskTitle?: string | null;
}): InterrogationDecision {
  const required = shouldTriggerInterrogation(params);
  if (!required) {
    return { required: false, validation_status: "accepted" };
  }
  return {
    required: true,
    question: selectInterrogationQuestion(params),
    validation_status: "needs_interrogation",
  };
}
