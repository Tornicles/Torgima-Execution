import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import { getWorldModel } from "../engines/world-model/WorldModelEngine.js";

const router = Router();

router.get("/world-model", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const model = await getWorldModel(auth.userId);
    success(res, { worldModel: model });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
