import {
  changeControlEngine,
  schedulingEngine,
  gradualRolloutEngine,
  actionExecutorEngine,
  errorRecoveryEngine,
  performanceOptimizerEngine,
  workflowOrchestratorEngine,
  resourceAllocatorEngine,
  complianceEnforcerEngine,
  integrationManagerPlan,
} from "./operatingEngines.js";
import { validateBeforeExecution } from "./securityGate.js";
import { decisionEngine } from "../decision/decision-engine/DecisionEngine.js";
import { teamEngine } from "../teams/team-engine/TeamEngine.js";
import { identityEngine } from "../identity/identity-engine/IdentityEngine.js";
import { experimentEngine } from "../experiments/experiment-engine/ExperimentEngine.js";
import { erectorRuntime } from "../erector/runtime/ErectorRuntime.js";
import { civilizationEngine } from "../civilization/civilization-engine/CivilizationEngine.js";
import { expansionEngine } from "../expansion/expansion-engine/ExpansionEngine.js";
import { temporalEngine } from "../temporal/temporal-engine/TemporalEngine.js";
import { metaGovernor } from "../governor/governor-engine/MetaGovernor.js";
import { reliabilityEngine } from "../reliability/reliability-engine/ReliabilityEngine.js";
import { infrastructureEngine } from "../infrastructure/infrastructure-engine/InfrastructureEngine.js";
import { securityEngine } from "../security/security-engine/SecurityEngine.js";
import { governanceEngine } from "../governance/GovernanceEngine.js";
import {
  loadRecommendation,
  markImplemented,
  loadActiveConnections,
  logExecutionEvent,
  updateOperatingEngineMetrics,
} from "./operatingData.js";
import type { OperatingExecutionResult } from "./types.js";
import { ACTION_EXECUTOR_ENGINE_ID } from "./types.js";
import { logger } from "../../lib/logger.js";

export class OperatingService {
  /**
   * Execute an approved recommendation through the 10-engine operating pipeline.
   * Security gate runs first (Prompt 4).
   */
  async executeRecommendation(recommendationId: string): Promise<OperatingExecutionResult> {
    const started = Date.now();
    const recommendation = await loadRecommendation(recommendationId);

    if (!recommendation) {
      throw new Error("Recommendation not found");
    }

    if (recommendation.status !== "approved") {
      throw new Error("Only approved recommendations can execute");
    }

    let identityBlocked = false;
    let identityBlockReason: string | undefined;
    try {
      const identity = await identityEngine.process({
        blueprintId: recommendation.blueprintId,
        trigger: "EXECUTE_WORKFLOW",
        execution: { status: "pending", title: recommendation.title },
      });
      const valueCheck = identityEngine.validateExecutionAgainstValues(
        recommendation.title + " " + recommendation.description,
        identity,
      );
      if (!valueCheck.allowed) {
        identityBlocked = true;
        identityBlockReason = valueCheck.reason;
      }
    } catch {
      /* identity layer optional at execute time */
    }

    if (identityBlocked) {
      await logExecutionEvent(recommendation.blueprintId, "engine_run", "Identity engine blocked execution", {
        recommendationId,
        reason: identityBlockReason,
      });
      return {
        success: false,
        reason: identityBlockReason ?? "Execution would violate protected identity values",
        recommendation,
      };
    }

    try {
      const teamGate = await teamEngine.validateBeforeDecision({
        blueprintId: recommendation.blueprintId,
        name: "Execution Team",
        members: [{ userId: "system", role: "OWNER" }],
        execution: { proposal: recommendation.title, blocked: false },
      });
      if (!teamGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Team engine blocked execution", {
          recommendationId,
          reason: teamGate.reason,
        });
        return {
          success: false,
          reason: teamGate.reason ?? "Team alignment or health blocked execution",
          recommendation,
        };
      }
    } catch {
      /* team gate optional */
    }

    const decisionGate = await decisionEngine.requireDecisionForExecution({
      blueprintId: recommendation.blueprintId,
      recommendationId,
      trigger: "EXECUTE_WORKFLOW",
      goal: recommendation.title,
      title: recommendation.title,
      description: recommendation.description,
      confidence: recommendation.confidence,
    });

    if (!decisionGate.allowed) {
      await logExecutionEvent(recommendation.blueprintId, "engine_run", "Decision engine blocked execution", {
        recommendationId,
        decisionId: decisionGate.decision.decisionId,
        reason: decisionGate.reason,
      });
      return {
        success: false,
        reason: decisionGate.reason ?? "Execution requires decision formation",
        recommendation,
        decisionBlocked: true,
      };
    }

    try {
      const temporalGate = await temporalEngine.validateExecutionTiming(recommendation.blueprintId, {
        goal: recommendation.title,
        execution: { recommendationId },
      });
      if (!temporalGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Temporal engine blocked execution", {
          recommendationId,
          reason: temporalGate.reason,
        });
        return {
          success: false,
          reason: temporalGate.reason ?? "Execution timing is not favorable",
          recommendation,
        };
      }
    } catch {
      /* temporal gate optional */
    }

    try {
      const experimentGate = await experimentEngine.validateBeforeExecution(recommendation.blueprintId);
      if (!experimentGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Experiment engine blocked execution", {
          recommendationId,
          reason: experimentGate.reason,
        });
        return {
          success: false,
          reason: experimentGate.reason ?? "Active experiment must complete before execution",
          recommendation,
        };
      }
    } catch {
      /* experiment gate optional */
    }

    try {
      const erectorGate = await erectorRuntime.validateBeforeExecution({
        blueprintId: recommendation.blueprintId,
        goal: recommendation.title,
        validation: { recommendationId },
        seed: recommendation.blueprintId,
        scenario: "realistic",
      });
      if (!erectorGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Erector runtime blocked execution", {
          recommendationId,
          reason: erectorGate.reason,
        });
        return {
          success: false,
          reason: erectorGate.reason ?? "Synthetic reality did not survive — revise before execution",
          recommendation,
        };
      }
    } catch {
      /* erector gate optional */
    }

    try {
      const civilizationGate = await civilizationEngine.validateBeforeDecision({
        blueprintId: recommendation.blueprintId,
        world: { scope: recommendation.title },
        seed: recommendation.blueprintId,
      });
      if (!civilizationGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Civilization engine advisory block", {
          recommendationId,
          reason: civilizationGate.reason,
        });
        return {
          success: false,
          reason: civilizationGate.reason ?? "Civilization trajectory requires long-horizon review before execution",
          recommendation,
        };
      }
    } catch {
      /* civilization gate optional — advises, does not govern */
    }

    try {
      const governorGate = await metaGovernor.validateBeforeGovernance({
        blueprintId: recommendation.blueprintId,
        execution: {
          recommendationId,
          title: recommendation.title,
          status: "pending",
        },
        decisions: { impact: recommendation.confidence ?? 0.5 },
      });
      if (!governorGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Meta governor blocked execution", {
          recommendationId,
          reason: governorGate.reason,
        });
        return {
          success: false,
          reason: governorGate.reason ?? "Meta governor coordination blocked execution",
          recommendation,
        };
      }
    } catch {
      /* meta governor gate optional */
    }

    try {
      const infraGate = await infrastructureEngine.validateBeforeExecution({
        blueprintId: recommendation.blueprintId,
        execution: {
          recommendationId,
          title: recommendation.title,
        },
        traffic: { load: 0.5 },
      });
      if (!infraGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Infrastructure blocked execution", {
          recommendationId,
          reason: infraGate.reason,
        });
        return {
          success: false,
          reason: infraGate.reason ?? "Infrastructure cannot support execution",
          recommendation,
        };
      }
    } catch {
      /* infrastructure gate optional */
    }

    try {
      const securityGate = await securityEngine.validateBeforeExecution({
        blueprintId: recommendation.blueprintId,
        actorId: "bhudhi-operating",
        identity: { verified: true, role: "system" },
        execution: {
          recommendationId,
          title: recommendation.title,
        },
        capabilities: [{ capability: "execution.run", level: "PRIVILEGED", scope: recommendation.blueprintId }],
        requestedPermission: "execute",
      });
      if (!securityGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Security engine blocked execution", {
          recommendationId,
          reason: securityGate.reason,
        });
        return {
          success: false,
          reason: securityGate.reason ?? "Security trust verification failed",
          recommendation,
        };
      }
    } catch {
      /* security gate optional */
    }

    try {
      const reliabilityGate = await reliabilityEngine.validateBeforeExecution({
        blueprintId: recommendation.blueprintId,
        execution: {
          recommendationId,
          title: recommendation.title,
          status: "pending",
        },
        decision: { impact: recommendation.confidence ?? 0.5 },
      });
      if (!reliabilityGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Reliability engine blocked execution", {
          recommendationId,
          reason: reliabilityGate.reason,
        });
        return {
          success: false,
          reason: reliabilityGate.reason ?? "Reliability evaluation blocked execution",
          recommendation,
        };
      }
    } catch {
      /* reliability gate optional */
    }

    try {
      const expansionGate = await expansionEngine.validateBeforeExecution({
        blueprintId: recommendation.blueprintId,
        results: { execution: { recommendationId } },
        governanceApproved: false,
      });
      if (!expansionGate.allowed) {
        await logExecutionEvent(recommendation.blueprintId, "engine_run", "Expansion engine blocked execution", {
          recommendationId,
          reason: expansionGate.reason,
        });
        return {
          success: false,
          reason: expansionGate.reason ?? "Unapproved expansion capability — governance required",
          recommendation,
        };
      }
    } catch {
      /* expansion gate optional */
    }

    const governance = await governanceEngine.enforceBeforeExecution({
      actor: { type: "system", id: "bhudhi-operating" },
      blueprintId: recommendation.blueprintId,
      recommendationId,
      confidence: recommendation.confidence,
      title: recommendation.title,
    });

    if (!governance.allowed) {
      await logExecutionEvent(recommendation.blueprintId, "engine_run", "Governance blocked execution", {
        recommendationId,
        governance: {
          enforcement: governance.enforcement,
          constraints: governance.constraints,
          pendingApprovalIds: governance.pendingApprovalIds,
        },
      });
      return {
        success: false,
        reason: governance.explanation.why,
        recommendation,
        governanceBlocked: true,
      };
    }

    const security = validateBeforeExecution(recommendation);
    if (!security.allowed) {
      await logExecutionEvent(recommendation.blueprintId, "engine_run", "Security gate blocked execution", {
        recommendationId,
        security,
      });
      return {
        success: false,
        reason: security.reason ?? "Security validation failed",
        recommendation,
        securityBlocked: true,
      };
    }

    const changeApproved = changeControlEngine(recommendation);
    if (!changeApproved) {
      await logExecutionEvent(recommendation.blueprintId, "engine_run", "Change control rejected", {
        recommendationId,
      });
      return {
        success: false,
        reason: "Change control rejected",
        recommendation,
      };
    }

    const schedule = schedulingEngine(recommendation);
    const rolloutPlan = gradualRolloutEngine(recommendation, schedule);
    const executionResult = actionExecutorEngine(recommendation, rolloutPlan);

    if (!executionResult.success) {
      const recovery = errorRecoveryEngine(recommendation, executionResult);
      await logExecutionEvent(recommendation.blueprintId, "engine_run", "Execution failed — recovery initiated", {
        recommendationId,
        recovery,
        executionResult,
      });
      await updateOperatingEngineMetrics(ACTION_EXECUTOR_ENGINE_ID, Date.now() - started, false);
      return {
        success: false,
        reason: "Execution failed, recovery initiated",
        executionResult,
        recommendation,
        rolloutPlan,
        schedule,
      };
    }

    if (executionResult.requiresIntegration) {
      const connections = await loadActiveConnections(recommendation.blueprintId);
      const syncPlan = integrationManagerPlan(connections.length);
      for (let i = 0; i < connections.length; i++) {
        const conn = connections[i]!;
        const sync = syncPlan[i];
        logger.info(
          { systemName: conn.system_name, synced: sync?.synced ?? true },
          "[Operating] Integration sync",
        );
      }
      await logExecutionEvent(recommendation.blueprintId, "engine_run", "External integrations updated", {
        recommendationId,
        connectionCount: connections.length,
      });
    }

    const optimized = performanceOptimizerEngine(executionResult);
    const workflow = workflowOrchestratorEngine(recommendation, optimized);
    const allocation = resourceAllocatorEngine(recommendation, executionResult);
    const compliant = complianceEnforcerEngine(executionResult);

    if (!compliant.verified) {
      await logExecutionEvent(recommendation.blueprintId, "engine_run", "Compliance check failed", {
        recommendationId,
        issues: compliant.issues,
      });
      return {
        success: false,
        reason: "Compliance check failed",
        complianceIssues: compliant.issues,
        recommendation,
        executionResult,
        rolloutPlan,
        schedule,
      };
    }

    await markImplemented(recommendationId);
    await logExecutionEvent(recommendation.blueprintId, "recommendation_applied", recommendation.title, {
      recommendationId,
      actionId: executionResult.actionId,
      allocation,
      workflow,
      optimized,
      rolloutPlan,
      schedule,
    });

    await updateOperatingEngineMetrics(ACTION_EXECUTOR_ENGINE_ID, Date.now() - started, true);

    const updated = await loadRecommendation(recommendationId);

    return {
      success: true,
      executionResult,
      optimizationResult: optimized,
      workflow,
      complianceVerified: true,
      recommendation: updated ?? recommendation,
      rolloutPlan,
      schedule,
    };
  }

  async getOperatingStatus(recommendationId: string) {
    const recommendation = await loadRecommendation(recommendationId);
    if (!recommendation) return null;
    return {
      id: recommendation.id,
      status: recommendation.status,
      appliedAt: recommendation.appliedAt,
      confidence: recommendation.confidence,
      title: recommendation.title,
    };
  }
}

export const operatingService = new OperatingService();
