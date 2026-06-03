/** Plain-language labels for enforcement / order action keys (DOC 35). */
export const ENFORCEMENT_ACTION_LABELS: Record<string, string> = {
  task_execution: "Start or continue your current task",
  feedback_submission: "Submit feedback",
  academy_tasks: "Complete a learning task",
  recovery_task: "Start recovery task",
  request_explanation: "Request explanation",
  goal_creation: "Create a new goal",
  scaling_tasks: "Take on scaling tasks",
  pivot_review: "Review your direction",
  start: "Start",
  continue: "Continue",
  submit_feedback: "Submit feedback",
  report_blocked: "Report a blocker",
  view_details: "View details",
  refresh: "Refresh",
};

export function formatEnforcementActions(keys: string[], max = 3): string[] {
  return keys.slice(0, max).map((key) => {
    const k = key.toLowerCase();
    return (
      ENFORCEMENT_ACTION_LABELS[k] ??
      k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  });
}
