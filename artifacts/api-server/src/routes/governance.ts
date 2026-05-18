import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import {
  approveProposal,
  rejectProposal,
  getPendingProposals,
  getProposalHistory,
} from "../engines/governance/GovernanceService.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";

const router = Router();

async function assertBlueprintAccess(blueprintId: string, userId: string): Promise<void> {
  await BlueprintRepository.findById(blueprintId, userId);
}

router.get("/governance/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { blueprintId } = req.params;
    await assertBlueprintAccess(blueprintId, auth.userId);
    const pending = await getPendingProposals(blueprintId);
    success(res, { pending });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/governance/:blueprintId/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { blueprintId } = req.params;
    await assertBlueprintAccess(blueprintId, auth.userId);
    const history = await getProposalHistory(blueprintId);
    success(res, { history });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/governance/:queueId/approve", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { queueId } = req.params;
    const result = await approveProposal(queueId, auth.userId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/governance/:queueId/reject", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { queueId } = req.params;
    const body = z.object({ reason: z.string().optional() }).parse(req.body ?? {});
    await rejectProposal(queueId, auth.userId, body.reason);
    success(res, { rejected: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
