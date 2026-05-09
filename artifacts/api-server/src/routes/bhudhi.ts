import { Router } from "express";
import { BhudhiCore } from "../bhudhi/BhudhiCore.js";
import { UserService } from "../services/UserService.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();
const bhudhi = new BhudhiCore();

// POST /api/bhudhi/structure-goal
router.post("/bhudhi/structure-goal", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { rawGoal, context } = req.body as { rawGoal: string; context?: string };
    const result = await bhudhi.call({
      trigger: "blueprint_generation",
      userId: user.id,
      context: { rawGoal, context },
    });
    // Return a structured goal shape
    const output = result.output as Record<string, unknown>;
    success(res, {
      title: output["title"] ?? rawGoal.slice(0, 80),
      domain: output["domain"] ?? "genesis",
      phases: output["phases"] ?? ["Foundation", "Build", "Scale", "Sustain"],
      milestones: output["milestones"] ?? [],
      estimatedWeeks: output["estimatedWeeks"] ?? 12,
      reasoning: output["reasoning"] ?? "Goal structured based on execution system analysis.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/explain-state
router.post("/bhudhi/explain-state", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { blueprintId, focus } = req.body as { blueprintId: string; focus?: string };
    const result = await bhudhi.call({
      trigger: "condition_explanation",
      userId: user.id,
      context: { blueprintId, focus },
    });
    const output = result.output as Record<string, unknown>;
    success(res, {
      summary: output["summary"] ?? "Your execution system is running. Keep going.",
      condition: output["condition"] ?? "building",
      recommendation: output["recommendation"] ?? "Complete your next active task.",
      details: output["details"] ?? [],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
