import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFeedbackPayload,
  completionToApiStatus,
  parseTaskExecutionView,
  proofValid,
} from "@/lib/task-feedback";
import type { FeedbackFormState, TaskExecutionView } from "@/types/task-execution";
import { initialProofState } from "@/lib/task-feedback";

const root = resolve(import.meta.dirname, "../../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("DOC 34 — Task execution & feedback", () => {
  it("task page loads execution view and blocked state", () => {
    const page = readRepo("src/pages/task.tsx");
    expect(page).toContain("fetchOrderDetail");
    expect(page).toContain("parseTaskExecutionView");
    expect(page).toContain("BlockedTaskState");
    expect(page).toContain("FeedbackForm");
    expect(page).toContain("TaskSkeleton");
  });

  it("feedback page uses shared FeedbackForm with stable idempotency", () => {
    const page = readRepo("src/pages/feedback.tsx");
    expect(page).toContain("FeedbackForm");
    expect(page).toContain("fetchOrderDetail");
    expect(page).not.toContain("Date.now()");
    const form = readRepo("src/components/tasks/FeedbackForm.tsx");
    expect(form).toContain("generateIdempotencyKey");
    expect(form).toContain("runDashboardMutation");
    expect(form).toContain("expectedStateVersion");
  });

  it("proof validation enforces TEXT minimum length", () => {
    const order: TaskExecutionView = {
      orderId: "o1",
      stateVersion: 1,
      title: "T",
      instruction: "Do",
      successCriteria: [],
      taskType: "execution",
      difficulty: "moderate",
      proofType: "TEXT",
      proofInstruction: "Describe",
      allowedFeedbackTypes: ["COMPLETED"],
      blocked: false,
      timeEstimateMinutes: 30,
      proofRequired: true,
    };
    const proof = initialProofState("TEXT");
    expect(proofValid(order, { ...proof, proofText: "short" })).toBe(false);
    expect(proofValid(order, { ...proof, proofText: "x".repeat(20) })).toBe(true);
  });

  it("maps BLOCKED completion to failed API status with blocker", () => {
    expect(completionToApiStatus("BLOCKED")).toBe("failed");
    const order: TaskExecutionView = {
      orderId: "o1",
      stateVersion: 3,
      title: "T",
      instruction: "Do",
      successCriteria: [],
      taskType: "execution",
      difficulty: "moderate",
      proofType: "NONE",
      proofInstruction: "",
      allowedFeedbackTypes: ["BLOCKED"],
      blocked: false,
      timeEstimateMinutes: null,
      proofRequired: false,
    };
    const form: FeedbackFormState = {
      completion: "BLOCKED",
      proof: initialProofState("NONE"),
      blockerReason: "Waiting on dependency",
      reflection: "",
    };
    const payload = buildFeedbackPayload(order, form, 3, "feedback-o1:uuid");
    expect(payload.completionStatus).toBe("failed");
    expect(payload.expectedStateVersion).toBe(3);
    expect(payload.idempotencyKey).toBe("feedback-o1:uuid");
    expect(payload.blockerJson).toBeDefined();
  });

  it("parses taskExecution from order detail envelope", () => {
    const view = parseTaskExecutionView({
      id: "ord-1",
      stateVersion: 5,
      taskExecution: {
        orderId: "ord-1",
        proofType: "FILE",
        allowedFeedbackTypes: ["COMPLETED", "PARTIAL"],
      },
    });
    expect(view?.orderId).toBe("ord-1");
    expect(view?.proofType).toBe("FILE");
    expect(view?.allowedFeedbackTypes).toContain("PARTIAL");
  });

  it("API builds task execution view on GET order", () => {
    expect(
      readFileSync(resolve(root, "../api-server/src/lib/taskExecutionView.ts"), "utf8"),
    ).toContain("buildTaskExecutionView");
  });
});
