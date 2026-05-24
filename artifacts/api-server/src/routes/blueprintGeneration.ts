import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import {
  getBlueprintGenerateReady,
  resolveBlueprintDomain,
  runFullBlueprintGenerationFlow,
} from "../services/BlueprintGenerationFlowService.js";
import { generateInterpretation } from "../bhudhi/agents/BlueprintAgent.js";
import { getBlueprintStructure } from "../engines/blueprint/BlueprintStructureService.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";

const router = Router();

router.get("/blueprint/generate-ready/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (req.params.userId !== auth.userId) {
      failure(res, "FORBIDDEN", "Cannot check readiness for another user", 403);
      return;
    }
    const ready = await getBlueprintGenerateReady(auth.userId);
    success(res, ready);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/blueprint/resolve-domain", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z.object({ blueprintId: z.string().uuid() }).parse(req.body);
    await BlueprintRepository.findById(body.blueprintId, auth.userId);
    const result = await resolveBlueprintDomain(body.blueprintId, auth.userId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/blueprint/generate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const pathType = z.enum(["current", "adjusted", "alternative"]);
    const nullishUuid = z.preprocess(
      (value) => (value === null || value === "" ? undefined : value),
      z.string().uuid().optional(),
    );
    const body = z
      .object({
        blueprintId: z.string().uuid(),
        validationContractId: nullishUuid,
        validation_contract_id: nullishUuid,
        validationId: nullishUuid,
        validation_id: nullishUuid,
        selectedPath: pathType.optional().default("current"),
        selected_path_type: pathType.optional(),
        selectedBlueprintLevel: z.enum(["starter", "growth", "ultimate"]).optional().default("starter"),
        tier: z.enum(["starter", "growth", "ultimate"]).optional(),
      })
      .parse(req.body);
    const validationContractId = body.validationContractId ?? body.validation_contract_id;
    const selectedPathType = body.selectedPath ?? body.selected_path_type ?? "current";
    if (!validationContractId || !selectedPathType) {
      failure(
        res,
        "VALIDATION_ERROR",
        "validation_contract_id and selected_path_type are required",
        400,
      );
      return;
    }
    await BlueprintRepository.findById(body.blueprintId, auth.userId);
    const result = await runFullBlueprintGenerationFlow({
      userId: auth.userId,
      blueprintId: body.blueprintId,
      validationContractId,
      selectedPathType,
    });
    success(res, result, 201);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/blueprint/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const structure = await getBlueprintStructure(req.params.id);
    if (structure.blueprint.user_id !== auth.userId) {
      failure(res, "FORBIDDEN", "Not your blueprint", 403);
      return;
    }
    success(res, structure);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/blueprint/:id/interpret", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    await BlueprintRepository.findById(req.params.id, auth.userId);
    const interpretation = await generateInterpretation(req.params.id, auth.userId);
    success(res, { interpretation });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
