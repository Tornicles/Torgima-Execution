import { Router } from "express";
import { UserService } from "../services/UserService.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/onboarding/status
router.get("/onboarding/status", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const blueprints = await BlueprintService.list(user.id);
    const activeBlueprint = blueprints.find((b) => b.status === "active");
    success(res, {
      completed: user.onboardingCompleted,
      step: user.onboardingCompleted ? "done" : "goal",
      blueprintId: activeBlueprint?.id ?? null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/onboarding/goal
router.post("/onboarding/goal", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { rawGoal, domain } = req.body as { rawGoal: string; domain?: string };
    const blueprint = await BlueprintService.create(user.id, rawGoal, domain ?? null);
    await BlueprintService.activate(blueprint.id, user.id);
    await UserService.completeOnboarding(user.id);
    success(res, {
      completed: true,
      step: "done",
      blueprintId: blueprint.id,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
