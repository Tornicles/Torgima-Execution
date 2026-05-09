import { Router } from "express";
import { OrderService } from "../services/OrderService.js";
import { UserService } from "../services/UserService.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/orders/active
router.get("/orders/active", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const orders = await OrderService.getActive(user.id);
    success(res, orders);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/orders/:id
router.get("/orders/:id", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const order = await OrderService.get(req.params.id!, user.id);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/orders/:id/start
router.post("/orders/:id/start", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const order = await OrderService.start(req.params.id!, user.id);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/orders/:id/finish
router.post("/orders/:id/finish", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const order = await OrderService.finish(req.params.id!, user.id);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/orders/:id/block
router.post("/orders/:id/block", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { reason } = req.body as { reason: string };
    const order = await OrderService.block(req.params.id!, user.id, reason);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/orders/:id/pause
router.post("/orders/:id/pause", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const order = await OrderService.pause(req.params.id!, user.id);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/orders/:id/resume
router.post("/orders/:id/resume", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const order = await OrderService.resume(req.params.id!, user.id);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
