import type {
  FeedbackCompletion,
  FeedbackFormState,
  ProofState,
  ProofType,
  TaskExecutionView,
} from "@/types/task-execution";

export const COMPLETION_LABELS: Record<FeedbackCompletion, string> = {
  COMPLETED: "I completed this task",
  PARTIAL: "I partially completed this task",
  FAILED: "I attempted but could not complete it",
  BLOCKED: "I was blocked and could not start",
  SKIPPED: "I skipped this task",
};

export function parseTaskExecutionView(data: unknown): TaskExecutionView | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const inner =
    root.taskExecution && typeof root.taskExecution === "object"
      ? (root.taskExecution as Record<string, unknown>)
      : root;
  const orderId = String(inner.orderId ?? root.id ?? "");
  if (!orderId) return null;
  return {
    orderId,
    stateVersion: Number(inner.stateVersion ?? root.stateVersion ?? 0),
    title: String(inner.title ?? root.title ?? ""),
    instruction: String(inner.instruction ?? root.instruction ?? ""),
    successCriteria: Array.isArray(inner.successCriteria)
      ? inner.successCriteria.map(String)
      : [],
    taskType: String(inner.taskType ?? root.taskType ?? "execution"),
    difficulty: String(inner.difficulty ?? root.difficulty ?? "moderate"),
    proofType: (String(inner.proofType ?? root.proofType ?? "NONE").toUpperCase() ||
      "NONE") as ProofType,
    proofInstruction: String(
      inner.proofInstruction ?? root.proofDescription ?? "Submit evidence if required.",
    ),
    allowedFeedbackTypes: Array.isArray(inner.allowedFeedbackTypes)
      ? (inner.allowedFeedbackTypes as FeedbackCompletion[])
      : ["COMPLETED", "PARTIAL", "FAILED", "SKIPPED"],
    priorityReason:
      (inner.priorityReason as string | null) ?? (root.whyItMatters as string | null) ?? null,
    blocked: Boolean(inner.blocked),
    disabledReason: inner.disabledReason as string | undefined,
    timeEstimateMinutes:
      (inner.timeEstimateMinutes as number | null) ??
      (root.timeEstimateMinutes as number | null) ??
      null,
    proofRequired: Boolean(inner.proofRequired ?? root.proofRequired),
  };
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function proofValid(order: TaskExecutionView, proof: ProofState): boolean {
  const type = order.proofType;
  if (type === "NONE" && !order.proofRequired) return true;
  if (type === "TEXT" || (order.proofRequired && type === "NONE")) {
    return (proof.proofText?.trim().length ?? 0) >= 20;
  }
  if (type === "FILE") return proof.proofFileIds.length > 0;
  if (type === "LINK") return proof.proofLinks.some((l) => isValidUrl(l.trim()));
  if (type === "CHECKLIST") {
    return (
      proof.checklistAnswers.length > 0 && proof.checklistAnswers.every((a) => a.completed)
    );
  }
  if (type === "OUTPUT") {
    const fields = proof.outputFields ?? {};
    return Object.values(fields).every((v) => v.trim().length >= 3);
  }
  return true;
}

export function completionToApiStatus(
  completion: FeedbackCompletion,
): "completed" | "partial" | "failed" | "skipped" {
  if (completion === "PARTIAL") return "partial";
  if (completion === "FAILED" || completion === "BLOCKED") return "failed";
  if (completion === "SKIPPED") return "skipped";
  return "completed";
}

export function buildFeedbackPayload(
  order: TaskExecutionView,
  form: FeedbackFormState,
  expectedStateVersion: number,
  idempotencyKey: string,
): Record<string, unknown> {
  const completion = form.completion!;
  const apiStatus = completionToApiStatus(completion);
  const reflection =
    form.reflection?.trim() ||
    form.userNotes?.trim() ||
    (completion === "BLOCKED" ? form.blockerReason?.trim() : "") ||
    "Execution report submitted.";

  const payload: Record<string, unknown> = {
    completionStatus: apiStatus,
    score: form.score ?? 7,
    reflection: reflection.length >= 10 ? reflection : `${reflection} `.padEnd(10, "."),
    difficultyFelt: form.difficultyFelt ?? "moderate",
    expectedStateVersion,
    idempotencyKey,
    durationMinutes: form.durationMinutes,
    frictionScore: form.frictionScore,
    confidenceScore: form.confidenceScore,
  };

  if (order.proofType === "TEXT" || order.proofType === "NONE") {
    if (form.proof.proofText?.trim()) {
      payload.proofJson = { text: form.proof.proofText.trim() };
    }
  }
  if (order.proofType === "FILE" && form.proof.proofFileIds.length) {
    payload.proofJson = { fileIds: form.proof.proofFileIds };
  }
  if (order.proofType === "LINK" && form.proof.proofLinks[0]) {
    payload.proofJson = { link: form.proof.proofLinks[0] };
  }
  if (order.proofType === "CHECKLIST") {
    payload.proofJson = { checklist: form.proof.checklistAnswers };
  }
  if (order.proofType === "OUTPUT" && form.proof.outputFields) {
    payload.proofJson = { output: form.proof.outputFields };
  }

  if (completion === "BLOCKED" || completion === "FAILED" || form.blockerReason?.trim()) {
    payload.blockerJson = {
      description: form.blockerReason?.trim() || reflection,
      type: completion === "BLOCKED" ? "dependency" : "other",
    };
  }

  return payload;
}

export const DEFAULT_CHECKLIST_ITEMS = [
  { itemId: "done-1", label: "I followed the instruction" },
  { itemId: "done-2", label: "I met the definition of done" },
  { itemId: "done-3", label: "I captured evidence" },
];

export function initialProofState(proofType: ProofType): ProofState {
  if (proofType === "CHECKLIST") {
    return {
      proofText: "",
      proofFileIds: [],
      proofLinks: [],
      checklistAnswers: DEFAULT_CHECKLIST_ITEMS.map((i) => ({
        itemId: i.itemId,
        completed: false,
      })),
      outputFields: {},
    };
  }
  if (proofType === "OUTPUT") {
    return {
      proofText: "",
      proofFileIds: [],
      proofLinks: [],
      checklistAnswers: [],
      outputFields: { result: "", notes: "" },
    };
  }
  return {
    proofText: "",
    proofFileIds: [],
    proofLinks: [""],
    checklistAnswers: [],
    outputFields: {},
  };
}
