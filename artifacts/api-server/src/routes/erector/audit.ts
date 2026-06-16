import { Router } from "express";
import { requireAuth } from "../../lib/auth.js";
import { handleError, failure } from "../../lib/utils.js";
import {
  erectorSuccess,
  finishErectorApiLog,
} from "../../lib/erectorApiHelpers.js";
import { decisionAuditService } from "../../services/erector/DecisionAuditService.js";
import { ModelVersioningService } from "../../services/erector/ModelVersioningService.js";
import {
  filterAuditRecordForTier,
  normalizeTierKey,
} from "../../services/erector/TierPermissionMatrix.js";

const auditRouter = Router();
const modelsRouter = Router();

auditRouter.get("/blueprint/:blueprintId", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const tier =
      typeof req.query.tier === "string" ? normalizeTierKey(req.query.tier) : "growth";
    const records = await decisionAuditService.getByBlueprint(
      req.params.blueprintId,
      auth.userId,
    );
    const filtered = records.map((record) => filterAuditRecordForTier(tier, record));

    await erectorSuccess(
      res,
      { blueprint_id: req.params.blueprintId, decisions: filtered, audit_visibility: tier },
      {
        message: "Decision audit history loaded.",
        blueprintId: req.params.blueprintId,
      },
    );

    await finishErectorApiLog({
      runType: "erector_api_audit_blueprint",
      req,
      userId: auth.userId,
      blueprintId: req.params.blueprintId,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

auditRouter.get("/:decisionId", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const tier =
      typeof req.query.tier === "string" ? normalizeTierKey(req.query.tier) : "growth";
    const record = await decisionAuditService.getByDecisionId(
      req.params.decisionId,
      auth.userId,
    );

    if (!record) {
      failure(res, "NOT_FOUND", "Decision audit record not found", 404);
      return;
    }

    await erectorSuccess(res, filterAuditRecordForTier(tier, record), {
      message: "Decision audit record loaded.",
      blueprintId: record.blueprint_id,
    });

    await finishErectorApiLog({
      runType: "erector_api_audit_get",
      req,
      userId: auth.userId,
      blueprintId: record.blueprint_id,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

modelsRouter.get("/versions", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const versions = await ModelVersioningService.getCurrentVersions();

    await erectorSuccess(res, { versions, component_count: Object.keys(versions).length }, {
      message: "Model versions loaded.",
    });

    await finishErectorApiLog({
      runType: "erector_api_model_versions",
      req,
      userId: auth.userId,
      startedAt: started,
      statusCode: 200,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export { auditRouter, modelsRouter };
export default auditRouter;
