import { OrderStatus } from "@workspace/state-machine";

export type FeedbackCompletionType = "COMPLETED" | "PARTIAL" | "FAILED" | "BLOCKED" | "SKIPPED";

export type TaskExecutionView = {
  orderId: string;
  stateVersion: number;
  title: string;
  instruction: string;
  successCriteria: string[];
  taskType: string;
  difficulty: string;
  proofType: "NONE" | "TEXT" | "FILE" | "LINK" | "CHECKLIST" | "OUTPUT";
  proofInstruction: string;
  allowedFeedbackTypes: FeedbackCompletionType[];
  priorityReason?: string | null;
  blocked: boolean;
  disabledReason?: string;
  timeEstimateMinutes?: number | null;
  proofRequired: boolean;
};

function normalizeProofType(raw: string | null | undefined, proofRequired: boolean): TaskExecutionView["proofType"] {
  const t = (raw ?? "").toUpperCase();
  if (t === "TEXT" || t === "FILE" || t === "LINK" || t === "CHECKLIST" || t === "OUTPUT") return t;
  if (proofRequired) return "TEXT";
  return "NONE";
}

export function buildTaskExecutionView(params: {
  order: {
    id: string;
    title: string;
    instruction: string;
    expected_output: string;
    definition_of_done: string;
    why_it_matters: string | null;
    difficulty: string;
    task_type: string;
    time_estimate_minutes: number | null;
    proof_required: boolean;
    proof_type: string | null;
    proof_description: string | null;
    status: string;
    blocker_description?: string | null;
  };
  stateVersion: number;
  commandContextProof?: string | null;
}): TaskExecutionView {
  const blocked = params.order.status === OrderStatus.BLOCKED;
  const proofRequired = params.order.proof_required;
  const proofType = normalizeProofType(params.order.proof_type, proofRequired);

  const successCriteria: string[] = [];
  if (params.order.definition_of_done?.trim()) {
    successCriteria.push(params.order.definition_of_done.trim());
  }
  if (params.order.expected_output?.trim()) {
    successCriteria.push(`Output: ${params.order.expected_output.trim()}`);
  }

  const allowed: FeedbackCompletionType[] = ["COMPLETED", "PARTIAL", "FAILED", "SKIPPED"];
  if (blocked) {
    return {
      orderId: params.order.id,
      stateVersion: params.stateVersion,
      title: params.order.title,
      instruction: params.order.instruction,
      successCriteria,
      taskType: params.order.task_type,
      difficulty: params.order.difficulty,
      proofType,
      proofInstruction:
        params.order.proof_description?.trim() ||
        params.commandContextProof?.trim() ||
        "Evidence may be required when you can resume.",
      allowedFeedbackTypes: ["BLOCKED", "FAILED"],
      priorityReason: params.order.why_it_matters,
      blocked: true,
      disabledReason:
        params.order.blocker_description?.trim() ||
        "This step is blocked until a dependency is resolved.",
      timeEstimateMinutes: params.order.time_estimate_minutes,
      proofRequired,
    };
  }

  return {
    orderId: params.order.id,
    stateVersion: params.stateVersion,
    title: params.order.title,
    instruction: params.order.instruction,
    successCriteria,
    taskType: params.order.task_type,
    difficulty: params.order.difficulty,
    proofType,
    proofInstruction:
      params.order.proof_description?.trim() ||
      params.commandContextProof?.trim() ||
      (proofRequired ? "Submit evidence of what you completed." : "No proof required for this step."),
    allowedFeedbackTypes: allowed,
    priorityReason: params.order.why_it_matters,
    blocked: false,
    timeEstimateMinutes: params.order.time_estimate_minutes,
    proofRequired,
  };
}
