import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import {
  fillBlueprintTaskQueue,
  getTaskQueueSnapshot,
} from "../engines/task-engine/TaskEngine.js";
import { buildQueueDayPattern } from "../engines/mini-plan/MiniPlanAllocationEngine.js";

const router = Router();

router.get("/tasks/queue", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = typeof req.query.blueprintId === "string" ? req.query.blueprintId : "";
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const snapshot = await getTaskQueueSnapshot(blueprintId, auth.userId);
    const todayPattern = buildQueueDayPattern(snapshot.dailyTaskCounts);

    success(res, {
      ...snapshot,
      todayPattern,
      visiblePattern: snapshot.visibleToday.map((t) => {
        const k = t.miniPlanKey ?? "Operations";
        return k === "Foundation" ? "F" : k === "Growth" ? "G" : "O";
      }),
      principles: {
        visibleQueue: "Today only — tasks you execute now",
        hiddenQueue: `${snapshot.horizonDays} days ahead, regenerated when condition changes`,
        neverRunsOut: true,
      },
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/tasks/queue/fill", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.body?.blueprintId === "string"
        ? req.body.blueprintId
        : typeof req.query.blueprintId === "string"
          ? req.query.blueprintId
          : "";
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const result = await fillBlueprintTaskQueue({
      blueprintId,
      userId: auth.userId,
      generationMode: "queue_fill",
      generationTrigger: "manual_queue_fill",
    });

    const snapshot = await getTaskQueueSnapshot(blueprintId, auth.userId);

    success(res, {
      generated: result.generated,
      revealed: result.revealed,
      snapshot,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
