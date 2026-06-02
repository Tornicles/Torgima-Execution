/**
 * Phase 5 / DOC 26 — resolution task specs per dependency type.
 */

import type { ResolutionTaskSpec } from "../execution-loop/DependencyEngine.js";

export const DEPENDENCY_TYPES = [
  "SEQUENCE",
  "DECISION",
  "INFORMATION",
  "ASSET",
  "PERMISSION",
  "EXTERNAL_RESPONSE",
  "CAPABILITY",
  "OUTCOME_PROOF",
  "SYSTEM_STATE",
] as const;

export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export function unlockValueForDependency(
  depType: DependencyType,
  blocksMultiple: boolean,
  userControllable: boolean,
): number {
  let score = blocksMultiple ? 1.0 : 0.8;
  if (userControllable) score += 0.3;
  if (depType === "EXTERNAL_RESPONSE") score -= 0.2;
  return Math.max(0, score);
}

export function resolutionTaskForDependencyType(
  depType: DependencyType,
  detail: { title?: string; instruction?: string; blockerLabel?: string },
): ResolutionTaskSpec {
  switch (depType) {
    case "DECISION":
      return {
        task_type: "clarification",
        title: detail.title ?? "Decision needed before continuing",
        instruction:
          detail.instruction ??
          "Answer the one blocking question below so execution can proceed.",
        expected_output: "A clear decision recorded in your notes.",
        proof_required: true,
        proof_type: "text",
        why_it_matters: "Execution is blocked until this decision is made.",
        difficulty: "easy",
      };
    case "INFORMATION":
      return {
        task_type: "clarification",
        title: detail.title ?? "Collect missing information",
        instruction:
          detail.instruction ??
          "Gather the missing context required to execute the next step.",
        expected_output: "Required information documented.",
        proof_required: true,
        proof_type: "text",
        why_it_matters: "The task cannot run without this context.",
        difficulty: "easy",
      };
    case "ASSET":
      return {
        task_type: "blocker_resolution",
        title: detail.title ?? "Submit required asset",
        instruction:
          detail.instruction ?? "Upload or link the file/deliverable needed to proceed.",
        expected_output: "Asset attached or link provided.",
        proof_required: true,
        proof_type: "file",
        why_it_matters: "An asset is required before work can continue.",
        difficulty: "easy",
      };
    case "PERMISSION":
      return {
        task_type: "blocker_resolution",
        title: detail.title ?? "Restore access or permission",
        instruction:
          detail.instruction ??
          "Fix session, authorization, or external access so the task can run.",
        expected_output: "Permission restored or workaround documented.",
        proof_required: true,
        proof_type: "text",
        why_it_matters: "Execution is blocked by missing permission.",
        difficulty: "easy",
      };
    case "EXTERNAL_RESPONSE":
      return {
        task_type: "blocker_resolution",
        title: detail.title ?? "External follow-up check-in",
        instruction:
          detail.instruction ??
          "Follow up on the third-party response or approval you are waiting for.",
        expected_output: "Status update or approval received.",
        proof_required: true,
        proof_type: "text",
        why_it_matters: "Progress depends on an external party.",
        difficulty: "easy",
      };
    case "CAPABILITY":
      return {
        task_type: "academy",
        title: detail.title ?? "Build required capability",
        instruction:
          detail.instruction ??
          "Complete a short academy exercise to close the capability gap blocking this task.",
        expected_output: "Capability exercise completed with proof.",
        proof_required: true,
        proof_type: "text",
        why_it_matters: "Your capability profile does not yet meet this task requirement.",
        difficulty: "easy",
      };
    case "OUTCOME_PROOF":
      return {
        task_type: "review",
        title: detail.title ?? "Validate required outcome",
        instruction:
          detail.instruction ??
          "Submit evidence that the prerequisite outcome is validated.",
        expected_output: "Outcome validation evidence attached.",
        proof_required: true,
        proof_type: "text",
        why_it_matters: "This task requires a validated outcome first.",
        difficulty: "easy",
      };
    case "SYSTEM_STATE":
      return {
        task_type: "recovery",
        title: detail.title ?? "System state repair",
        instruction:
          detail.instruction ??
          "Refresh your session or wait for system repair, then retry.",
        expected_output: "System state healthy enough to continue.",
        proof_required: false,
        proof_type: "text",
        why_it_matters: "A system state issue is blocking execution.",
        difficulty: "easy",
      };
    case "SEQUENCE":
    default:
      return {
        task_type: "blocker_resolution",
        title: detail.title ?? "Complete prerequisite task first",
        instruction:
          detail.instruction ??
          `Complete the prerequisite step${detail.blockerLabel ? ` (${detail.blockerLabel})` : ""} before continuing.`,
        expected_output: "Prerequisite completed with verified output.",
        proof_required: true,
        proof_type: "text",
        why_it_matters: "This task depends on a prior step being complete.",
        difficulty: "easy",
      };
  }
}
