import { db } from "@workspace/db";
import { policyEngine } from "./policy-engine/PolicyEngine.js";
import { approvalEngine, APPROVAL_LEVEL_ORDER } from "./approval-engine/ApprovalEngine.js";
import { riskGovernor } from "./risk/RiskGovernor.js";
import { explainabilityEngine } from "./explainability/ExplainabilityEngine.js";
import { governanceAudit } from "./audit/GovernanceAudit.js";
import { governanceEnforcer } from "./enforcement/GovernanceEnforcer.js";
import { emergencyGovernor } from "./emergency/EmergencyGovernor.js";
import { governanceMemory } from "./governance-memory/GovernanceMemory.js";
import { upgradeControl } from "./upgrade-control/UpgradeControl.js";
import { isForbiddenAction } from "./contracts/immutableRules.js";
import type {
  GovernanceActor,
  GovernanceAction,
  GovernanceContext,
  GovernanceCheckResult,
  GovernanceHealth,
  ApprovalLevel,
  ExplainabilityRecord,
} from "./contracts/types.js";
import { logger } from "../../lib/logger.js";

export interface ExecutionGovernanceInput {
  actor: GovernanceActor;
  blueprintId: string;
  recommendationId: string;
  confidence?: number;
  globalSignal?: string;
  title?: string;
}

/**
 * Constitutional governance layer — sits above execution, below immutable laws.
 * Governance approves. Bhudhi executes.
 */
export class GovernanceEngine {
  async check(
    actor: GovernanceActor,
    action: GovernanceAction,
    context: GovernanceContext = {},
  ): Promise<GovernanceCheckResult> {
    if (isForbiddenAction(action)) {
      await governanceMemory.recordViolation({
        blueprintId: context.blueprintId,
        actorType: actor.type,
        actorId: actor.id,
        action,
        violationType: "constitutional",
        severity: "critical",
        detail: `Forbidden action attempted: ${action}`,
      });
    }

    const emergency = context.blueprintId
      ? await emergencyGovernor.getActiveMode(context.blueprintId)
      : await emergencyGovernor.getActiveMode();

    if (emergencyGovernor.blocksExecution(emergency)) {
      const policy = policyEngine.evaluatePolicy(actor, action, context);
      const risk = riskGovernor.assess(action, context);
      const explanation = explainabilityEngine.build({
        action,
        actor,
        policy: { ...policy, allowed: false },
        risk,
        allowed: false,
        enforcement: "REJECT",
        rejected: [`Emergency mode active: ${emergency}`],
      });

      await governanceAudit.append({
        blueprintId: context.blueprintId,
        eventType: "policy_failed",
        actor,
        action,
        decision: "REJECT",
        reasoning: `Emergency ${emergency}`,
        payload: { emergency },
      });

      return {
        allowed: false,
        enforcement: "REJECT",
        policy,
        risk,
        requiredApprovals: policy.requiredApprovals,
        pendingApprovalIds: [],
        explanation,
        constraints: [`Emergency mode: ${emergency}`],
      };
    }

    const trustScore = context.blueprintId
      ? await governanceMemory.getTrustScore(context.blueprintId)
      : 0.7;

    const enrichedContext: GovernanceContext = { ...context, trustScore };
    const policy = policyEngine.evaluatePolicy(actor, action, enrichedContext);
    const risk = riskGovernor.assess(action, enrichedContext);
    const enforcement = governanceEnforcer.decide(policy, risk, action);

    const minLevel = upgradeControl.minimumApprovalLevel(action);
    const requiredApprovals = [
      ...new Set([...policy.requiredApprovals, minLevel]),
    ] as ApprovalLevel[];

    let pendingApprovalIds: string[] = [];
    let hasApproval = false;

    if (context.blueprintId && context.recommendationId) {
      hasApproval = await approvalEngine.hasGrantedApproval(
        context.blueprintId,
        "recommendation",
        context.recommendationId,
        action,
        requiredApprovals.reduce((best, level) =>
          APPROVAL_LEVEL_ORDER.indexOf(level) > APPROVAL_LEVEL_ORDER.indexOf(best) ? level : best,
        "L0" as ApprovalLevel),
      );

      if (!hasApproval && requiredApprovals.some((l) => l >= "L2")) {
        const pending = await approvalEngine.getPendingForSubject(
          context.blueprintId,
          "recommendation",
          context.recommendationId,
          action,
        );
        if (pending.length === 0 && enforcement !== "REJECT") {
          const id = await approvalEngine.createApprovalRequest({
            blueprintId: context.blueprintId,
            subjectType: "recommendation",
            subjectId: context.recommendationId,
            action,
            level: requiredApprovals.includes("L4") ? "L4" : "L2",
          });
          pendingApprovalIds = [id];
        } else {
          pendingApprovalIds = pending.map((p) => p.id);
        }
      }
    }

    const needsApproval =
      requiredApprovals.some((l) => l >= "L2") && !hasApproval && actor.type !== "user";

    const userOverride =
      actor.type === "user" && hasApproval && enforcement === "ESCALATE";

    const allowed =
      policy.allowed &&
      enforcement !== "REJECT" &&
      (enforcement !== "ESCALATE" || userOverride) &&
      !needsApproval &&
      risk.riskType !== "LOCK";

    const explanation = explainabilityEngine.build({
      action,
      actor,
      policy,
      risk,
      allowed,
      enforcement,
      assumptions: [
        "Trigger Router remains first gate for AI",
        "Signals and Conditions are read-only",
        "Validation precedes execution",
      ],
    });

    await governanceAudit.append({
      blueprintId: context.blueprintId,
      eventType: "governance_check",
      actor,
      action,
      decision: allowed ? "ALLOW" : "REJECT",
      reasoning: explanation.why,
      payload: { enforcement, risk: risk.riskType, pendingApprovalIds },
    });

    return {
      allowed,
      enforcement,
      policy,
      risk,
      requiredApprovals,
      pendingApprovalIds,
      explanation,
      constraints: policy.constraints,
    };
  }

  async enforceBeforeExecution(input: ExecutionGovernanceInput): Promise<GovernanceCheckResult> {
    return this.check(
      input.actor,
      "EXECUTE_WORKFLOW",
      {
        blueprintId: input.blueprintId,
        recommendationId: input.recommendationId,
        confidence: input.confidence,
        globalSignal: input.globalSignal,
        metadata: { title: input.title },
      },
    );
  }

  async grantApproval(
    approvalId: string,
    actor: GovernanceActor,
    level: ApprovalLevel = "L2",
  ) {
    const result = await approvalEngine.grantApproval(approvalId, actor, level);
    if (result.granted) {
      await governanceAudit.append({
        eventType: "approval_granted",
        actor,
        action: "EXECUTE_WORKFLOW",
        decision: "GRANTED",
        reasoning: `Approval ${approvalId} granted at ${level}`,
        approvalId,
      });
    }
    return result;
  }

  async explain(check: GovernanceCheckResult): Promise<ExplainabilityRecord> {
    return check.explanation;
  }

  async getHealth(blueprintId: string): Promise<GovernanceHealth> {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const auditEvents = await governanceAudit.list(blueprintId, 100);
    const auditEvents24h = auditEvents.filter(
      (e) => e.created_at && new Date(e.created_at).getTime() >= since,
    ).length;

    const pendingApprovals = (await approvalEngine.listPending(blueprintId)).length;
    const trustScore = await governanceMemory.getTrustScore(blueprintId);
    const emergency = await emergencyGovernor.getActiveMode(blueprintId);
    const violations = await governanceMemory.listRecentViolations(blueprintId, 100);
    const unresolved = violations.filter((v) => !v.resolved).length;

    return {
      trustScore,
      activeEmergency: emergency,
      pendingApprovals,
      recentViolations: unresolved,
      auditEvents24h,
      policiesImmutable: true,
    };
  }

  async activateEmergency(
    blueprintId: string,
    mode: "SOFT_STOP" | "FREEZE" | "READ_ONLY",
    trigger: Parameters<typeof emergencyGovernor.activate>[2],
  ) {
    const id = await emergencyGovernor.activate(blueprintId, mode, trigger);
    await governanceAudit.append({
      blueprintId,
      eventType: "emergency_activated",
      actor: { type: "system", id: "governance" },
      action: "EXECUTE_WORKFLOW",
      decision: mode,
      reasoning: `Emergency: ${trigger}`,
      payload: { emergencyId: id },
    });
    logger.warn({ blueprintId, mode, trigger }, "[Governance] emergency activated");
    return id;
  }

  async clearEmergency(blueprintId: string) {
    await emergencyGovernor.clear(blueprintId);
    await governanceAudit.append({
      blueprintId,
      eventType: "emergency_cleared",
      actor: { type: "user", id: "operator" },
      action: "EXECUTE_WORKFLOW",
      decision: "CLEARED",
      reasoning: "Emergency mode cleared by operator",
    });
  }

  async rollback(blueprintId: string, reason: string): Promise<string> {
    const rollbackId = await governanceAudit.append({
      blueprintId,
      eventType: "rollback_triggered",
      actor: { type: "system", id: "governance" },
      action: "EXECUTE_WORKFLOW",
      decision: "ROLLBACK",
      reasoning: reason,
      result: "initiated",
    });
    return rollbackId;
  }
}

export const governanceEngine = new GovernanceEngine();
