import app from "./app.js";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger.js";
import { startWorkers } from "./workers/start.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.listen(PORT, async () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[SERVER] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
  console.log(`[SERVER] DATABASE_URL prefix: ${process.env.DATABASE_URL?.substring(0, 50)}`);

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("[SERVER] Database connection: OK");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SERVER] Database connection FAILED:", msg);
    console.error("[SERVER] Fix DATABASE_URL on Railway and redeploy");
  }

  startWorkers().catch((workerErr) => {
    logger.error({ err: workerErr }, "Failed to start workers");
  });
});
