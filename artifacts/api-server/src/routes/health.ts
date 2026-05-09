import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { success, handleError } from "../lib/utils.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", async (req, res) => {
  try {
    let database = false;
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      database = true;
    } catch {
      database = false;
    }
    success(res, { database });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
