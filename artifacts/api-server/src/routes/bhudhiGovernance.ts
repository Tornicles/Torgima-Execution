import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { governanceEngine } from "../bhudhi/governance/GovernanceEngine.js";
import { governanceAudit } from "../bhudhi/governance/audit/GovernanceAudit.js";
import { approvalEngine } from "../bhudhi/governance/approval-engine/ApprovalEngine.js";
import { capabilityRegistry } from "../bhudhi/governance/capability-engine/CapabilityRegistry.js";
import { riskGovernor } from "../bhudhi/governance/risk/RiskGovernor.js";
import { explainabilityEngine } from "../bhudhi/governance/explainability/ExplainabilityEngine.js";
import { IMMUTABLE_SYSTEM_LAWS } from "../bhudhi/governance/contracts/immutableRules.js";
import type { GovernanceAction, GovernanceActor } from "../bhudhi/governance/contracts/types.js";

const router = Router();

const actorSchema = z.object({
  type: z.enum(["user", "agent", "system", "bhudhi"]),
  id: z.string().min(1),
});

const actionSchema = z.enum([
  "READ_MEMORY",
  "CREATE_TASKS",
  "GENERATE_PLAN",
  "RUN_SIMULATION",
  "EXECUTE_WORKFLOW",
  "MEMORY_WRITE",
  "LEARNING_UPDATE",
  "DEPLOY_SYSTEM",
  "MODIFY_POLICIES",
  "MODIFY_SIGNALS",
  "MODIFY_CONDITIONS",
  "REWRITE_BLUEPRINT",
  "OVERRIDE_VALIDATION",
  "DISABLE_TRIGGER_ROUTER",
  "SELF_APPROVE",
  "DELETE_AUDIT",
  "ESCALATE_PRIVILEGE",
  "SELF_DEPLOY",
  "AGENT_SPAWN",
]);

// POST /api/bhudhi/governance/check
router.post("/bhudhi/governance/check", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        actor: actorSchema,
        action: actionSchema,
        blueprintId: z.string().uuid().optional(),
        recommendationId: z.string().uuid().optional(),
        confidence: z.number().min(0).max(1).optional(),
        globalSignal: z.string().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid governance check payload", 422);
      return;
    }

    if (parsed.data.blueprintId) {
      const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
      if (!ok) return;
    }

    const actor: GovernanceActor =
      parsed.data.actor.type === "user"
        ? { type: "user", id: auth.userId }
        : parsed.data.actor;

    const result = await governanceEngine.check(actor, parsed.data.action as GovernanceAction, {
      blueprintId: parsed.data.blueprintId,
      recommendationId: parsed.data.recommendationId,
      confidence: parsed.data.confidence,
      globalSignal: parsed.data.globalSignal,
    });

    bhudhiSuccess(res, {
      success: true,
      check: result,
      insight: result.explanation.why,
      confidence: result.explanation.confidence,
      reasoning: result.explanation.decision,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governance/approve
router.post("/bhudhi/governance/approve", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        approvalId: z.string().uuid(),
        level: z.enum(["L0", "L1", "L2", "L3", "L4", "L5"]).optional(),
        blueprintId: z.string().uuid().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "approvalId required", 422);
      return;
    }

    if (parsed.data.blueprintId) {
      const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
      if (!ok) return;
    }

    const result = await governanceEngine.grantApproval(
      parsed.data.approvalId,
      { type: "user", id: auth.userId },
      parsed.data.level ?? "L2",
    );

    bhudhiSuccess(res, {
      success: result.granted,
      ...result,
      insight: result.granted ? "Governance approval granted" : "Approval denied",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governance/audit
router.post("/bhudhi/governance/audit", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .safeParse(req.body ?? {});

    const blueprintId = parsed.success ? parsed.data.blueprintId : undefined;
    if (blueprintId) {
      const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
      if (!ok) return;
    }

    const events = await governanceAudit.list(blueprintId, parsed.success ? parsed.data.limit : 50);

    bhudhiSuccess(res, {
      success: true,
      events,
      count: events.length,
      immutable: true,
      insight: "Audit timeline is append-only and never deletable",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governance/risk
router.post("/bhudhi/governance/risk", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        action: actionSchema,
        confidence: z.number().optional(),
        globalSignal: z.string().optional(),
        costEstimate: z.number().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "action required", 422);
      return;
    }

    const risk = riskGovernor.assess(parsed.data.action as GovernanceAction, {
      confidence: parsed.data.confidence,
      globalSignal: parsed.data.globalSignal,
      costEstimate: parsed.data.costEstimate,
    });

    bhudhiSuccess(res, { success: true, risk });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governance/explain
router.post("/bhudhi/governance/explain", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        actor: actorSchema,
        action: actionSchema,
        blueprintId: z.string().uuid().optional(),
        allowed: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid explain payload", 422);
      return;
    }

    const check = await governanceEngine.check(
      parsed.data.actor as GovernanceActor,
      parsed.data.action as GovernanceAction,
      { blueprintId: parsed.data.blueprintId },
    );

    const explanation = explainabilityEngine.fromCheckResult(check);

    bhudhiSuccess(res, {
      success: true,
      explanation,
      whatHappened: explanation.decision,
      why: explanation.why,
      rejected: check.allowed ? [] : explanation.alternatives,
      assumptions: explanation.evidence,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governance/rollback
router.post("/bhudhi/governance/rollback", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        reason: z.string().min(3).max(500),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId and reason required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const rollbackId = await governanceEngine.rollback(parsed.data.blueprintId, parsed.data.reason);

    bhudhiSuccess(res, {
      success: true,
      rollbackId,
      insight: "Rollback initiated — audit record created",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governance/emergency
router.post("/bhudhi/governance/emergency", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        mode: z.enum(["SOFT_STOP", "FREEZE", "READ_ONLY", "ROLLBACK", "RECOVERY"]),
        trigger: z.enum([
          "unsafe_execution",
          "recursive_failures",
          "budget_exceeded",
          "memory_corruption",
          "critical_hallucination",
          "agent_conflict",
        ]),
        clear: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid emergency payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    if (parsed.data.clear) {
      await governanceEngine.clearEmergency(parsed.data.blueprintId);
      bhudhiSuccess(res, { success: true, cleared: true });
      return;
    }

    const id = await governanceEngine.activateEmergency(
      parsed.data.blueprintId,
      parsed.data.mode === "ROLLBACK" || parsed.data.mode === "RECOVERY"
        ? "FREEZE"
        : parsed.data.mode,
      parsed.data.trigger,
    );

    bhudhiSuccess(res, { success: true, emergencyId: id, mode: parsed.data.mode });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/governance/health — dashboard health + queue
router.get("/bhudhi/governance/health", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().safeParse(req.query.blueprintId);
    if (!blueprintId.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId query required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId.data, auth.userId);
    if (!ok) return;

    const health = await governanceEngine.getHealth(blueprintId.data);
    const pending = await approvalEngine.listPending(blueprintId.data);
    const capabilities = capabilityRegistry.list();

    bhudhiSuccess(res, {
      success: true,
      health,
      pendingApprovals: pending,
      capabilities: capabilities.length,
      immutableLaws: IMMUTABLE_SYSTEM_LAWS,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
