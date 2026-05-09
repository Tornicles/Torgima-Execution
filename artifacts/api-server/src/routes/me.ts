import { Router } from "express";
import { UserService } from "../services/UserService.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/me
router.get("/me", async (req, res) => {
  try {
    // TODO: Replace with real session auth — using demo user for Prompt 1
    const user = UserService.getDemoUser();
    success(res, user);
  } catch (err) {
    handleError(req, res, err);
  }
});

// PATCH /api/me
router.patch("/me", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { name, timezone } = req.body as { name?: string; timezone?: string };
    const updated = await UserService.update(user.id, { name, timezone });
    success(res, updated ?? user);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/me/settings
router.get("/me/settings", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const s = await UserService.getSettings(user.id);
    success(res, s);
  } catch (err) {
    handleError(req, res, err);
  }
});

// PATCH /api/me/settings
router.patch("/me/settings", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const updated = await UserService.updateSettings(user.id, req.body);
    success(res, updated);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
