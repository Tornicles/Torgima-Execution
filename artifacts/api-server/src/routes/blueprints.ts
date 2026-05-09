import { Router } from "express";
import { BlueprintService } from "../services/BlueprintService.js";
import { OrderService } from "../services/OrderService.js";
import { SignalService } from "../services/SignalService.js";
import { UserService } from "../services/UserService.js";
import { success, handleError } from "../lib/utils.js";
import type { BlueprintState } from "../types/blueprint.js";

const router = Router();

// GET /api/blueprints
router.get("/blueprints", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const blueprints = await BlueprintService.list(user.id);
    success(res, blueprints);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints
router.post("/blueprints", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { rawGoal, domain } = req.body as { rawGoal: string; domain?: string };
    const blueprint = await BlueprintService.create(user.id, rawGoal, domain ?? null);
    success(res, blueprint, 201);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/history
router.get("/blueprints/history", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const history = await BlueprintService.getHistory(user.id);
    success(res, history);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id
router.get("/blueprints/:id", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const blueprint = await BlueprintService.get(req.params.id!, user.id);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/activate
router.post("/blueprints/:id/activate", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const blueprint = await BlueprintService.activate(req.params.id!, user.id);
    OrderService.seed(blueprint.id, user.id);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/state
router.get("/blueprints/:id/state", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const blueprint = await BlueprintService.get(req.params.id!, user.id);
    const [activeOrders, signals] = await Promise.all([
      OrderService.getActive(user.id),
      SignalService.getCurrent(user.id),
    ]);
    const state: BlueprintState = {
      blueprint,
      activeOrders,
      signals,
      condition: signals.condition,
      phaseProgress: Math.round((blueprint.phase / blueprint.totalPhases) * 100),
    };
    success(res, state);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/pause
router.post("/blueprints/:id/pause", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { reason } = req.body as { reason: string };
    const blueprint = await BlueprintService.pause(req.params.id!, user.id, reason);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/resume
router.post("/blueprints/:id/resume", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const blueprint = await BlueprintService.resume(req.params.id!, user.id);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
