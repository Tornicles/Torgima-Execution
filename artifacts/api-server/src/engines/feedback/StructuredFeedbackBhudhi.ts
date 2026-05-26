import type { StructuredFeedbackSubmitPayload } from "../../types/structured-feedback.js";
import { interpretFeedback } from "../bhudhi/BhudhiInterpretationEngine.js";

export async function interpretStructuredFeedback(input: {
  userId: string;
  blueprintId: string;
  stateVersion: number;
  sessionId: string;
  payload: StructuredFeedbackSubmitPayload;
}) {
  const p = input.payload;
  const finished = p.taskStates.filter((t) => t.state === "Finished").length;
  const total = Math.max(p.taskStates.length, 1);
  const completed =
    finished === total ? "COMPLETED" : finished > 0 ? "PARTIAL" : "FAILED";
  const blocked = p.taskStates.some((t) => t.state === "Blocked");
  const friction = p.frictionType.filter((f) => f !== "nothing_blocked").join("; ");

  const interpretation = await interpretFeedback(
    {
      completed,
      score: Math.round((finished / total) * 10),
      reflection: p.realitySummary,
      blocker: blocked ? friction || "Task blocked during execution" : undefined,
      confidence: 0.8,
    },
    { userId: input.userId, blueprintId: input.blueprintId },
  );

  return {
    ...interpretation,
    reality: p.realitySummary ?? "User described today's execution reality.",
    tasks: p.taskStates.length,
    energy: p.emotionalState.join(", ") || "neutral",
    friction: p.frictionType.filter((f) => f !== "nothing_blocked"),
    outputs: p.outputType.filter((o) => o !== "no_tangible_output"),
  };
}
