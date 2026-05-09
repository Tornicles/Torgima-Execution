import { Router } from "express";
import { FeedbackService } from "../services/FeedbackService.js";
import { UserService } from "../services/UserService.js";
import { BhudhiCore } from "../bhudhi/BhudhiCore.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();
const bhudhi = new BhudhiCore();

// POST /api/feedback/task
router.post("/feedback/task", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { orderId, completionRating, effortRating, notes, blockers } = req.body as {
      orderId: string;
      completionRating: number;
      effortRating?: number;
      notes?: string;
      blockers?: string[];
    };
    const feedback = await FeedbackService.submit(
      user.id,
      orderId,
      completionRating,
      effortRating ?? null,
      notes ?? null,
      blockers ?? [],
    );
    success(res, feedback, 201);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/feedback/:id/interrogation
router.get("/feedback/:id/interrogation", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    // TODO: Look up feedback by id
    const result = await bhudhi.call({
      trigger: "feedback_interrogation",
      userId: user.id,
      context: { feedbackId: req.params.id },
    });
    success(res, {
      feedbackId: req.params.id,
      questions: result.output["questions"] ?? [
        "What specifically made this task hard?",
        "What would have made it easier?",
        "Is this blocker recurring?",
      ],
      context: null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/feedback/weekly-review
router.post("/feedback/weekly-review", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { blueprintId, overallRating, wins, challenges, notes } = req.body as {
      blueprintId: string;
      overallRating: number;
      wins?: string[];
      challenges?: string[];
      notes?: string;
    };
    const feedback = await FeedbackService.submitWeeklyReview(
      user.id,
      blueprintId,
      overallRating,
      wins ?? [],
      challenges ?? [],
      notes ?? null,
    );
    success(res, feedback, 201);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
