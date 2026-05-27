import { db, featureFlags } from "@workspace/db";
import { eq } from "drizzle-orm";
import { BHUDHI_MODEL } from "../lib/anthropic.js";
import { logger } from "../lib/logger.js";
import {
  FORBIDDEN_MODES,
  type BhudhiOutputEnvelope,
  type BhudhiTriggerRequest,
  type BhudhiTriggerResult,
} from "../types/bhudhi.js";
import { getContract, PromptRegistry } from "./PromptRegistry.js";
import type { BhudhiMode } from "../types/bhudhi.js";
import { getFallback } from "./FallbackLibrary.js";
import { validateOutput } from "./OutputValidator.js";
import { retrieveMemory } from "./MemoryService.js";
import { memoryGraph } from "./kernel/memory/memory-graph/MemoryGraph.js";
import {
  checkUsageAllowed,
  getMaxTokensForTrigger,
  getTimeout,
  logUsage,
  updateBhudhiLog,
} from "./UsageController.js";
import { reviewOutput } from "./agents/CriticAgent.js";
import { logFallbackUsage } from "./fallbackUsageLog.js";
import {
  checkTriggerAllowed,
  enterAgentChain,
  exitAgentChain,
  breakCircuit,
  incrementSessionOutput,
} from "../engines/stability/StabilityEngine.js";
import { getActiveAgentsForTrigger } from "./AgentRegistry.js";
import { appendErectorSearchUserPrompt, appendWebSearchInstruction } from "./erectorWebSearch.js";
import type { BhudhiProvider } from "./bhudhiProviders.js";
import { ERECTOR_SEARCH_TRIGGERS, providerForTrigger } from "./bhudhiProviders.js";
import { economicsEngine } from "./economics/EconomicsEngine.js";
import { beliefEngine } from "./beliefs/belief-engine/BeliefEngine.js";
import { worldEngine } from "./world/world-engine/WorldEngine.js";
import { identityEngine } from "./identity/identity-engine/IdentityEngine.js";
import { organizationEngine } from "./organization/organization-engine/OrganizationEngine.js";
import { teamEngine } from "./teams/team-engine/TeamEngine.js";
import { temporalEngine } from "./temporal/temporal-engine/TemporalEngine.js";
import { metaGovernor } from "./governor/governor-engine/MetaGovernor.js";
import { reliabilityEngine } from "./reliability/reliability-engine/ReliabilityEngine.js";
import { securityEngine } from "./security/security-engine/SecurityEngine.js";
import { infrastructureEngine } from "./infrastructure/infrastructure-engine/InfrastructureEngine.js";
import { erectorRuntime } from "./erector/runtime/ErectorRuntime.js";
import { civilizationEngine } from "./civilization/civilization-engine/CivilizationEngine.js";
import { expansionEngine } from "./expansion/expansion-engine/ExpansionEngine.js";

/** Sole LLM transport — implemented only in TriggerRouter (Bhudhi B1). */
export type BhudhiModelInvoker = (params: {
  provider: BhudhiProvider;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}) => Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  intelligenceGrounded: boolean;
  provider?: BhudhiProvider;
}>;

export type BhudhiPipelineDeps = {
  invokeModel: BhudhiModelInvoker;
};

// ── GOVERNED PIPELINE (TriggerRouter-only entry) ─────────────────────────────

function resolvePromptContract(request: BhudhiTriggerRequest & { requestedMode?: string }) {
  if (request.requestedMode) {
    return (
      PromptRegistry.lookup(request.triggerType, request.requestedMode) ??
      getContract(request.triggerType)
    );
  }
  return getContract(request.triggerType);
}

type PipelineRequest = BhudhiTriggerRequest & { requestedMode?: BhudhiMode };

export async function runBhudhiPipeline<T = unknown>(
  request: PipelineRequest,
  deps: BhudhiPipelineDeps,
): Promise<BhudhiTriggerResult<T>> {

  const startTime = Date.now();
  let logId = "";

  const chainId = `${request.userId}:${request.triggerType}`;
  const chain = enterAgentChain(chainId);
  if (!chain.allowed) {
    await breakCircuit(chainId, "Agent chain depth exceeded");
    exitAgentChain(chainId);
    const contractEarly = getContract(request.triggerType);
    let logId = "";
    if (contractEarly) {
      logId = await logUsage({
        userId: request.userId,
        blueprintId: request.blueprintId,
        triggerType: request.triggerType,
      sourceEngine: request.sourceEngine,
        promptName: contractEarly.name,
        promptVersion: contractEarly.version,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startTime,
        status: "rejected",
        fallbackReason: "agent_chain_depth_exceeded",
      }).catch(() => "");
    }
    return { ok: false, fallbackUsed: true, logId, failureReason: "Circuit breaker" };
  }

  const stabilityCheck = await checkTriggerAllowed(request.triggerType, request.userId);
  if (!stabilityCheck.allowed) {
    exitAgentChain(chainId);
    const contractEarly = getContract(request.triggerType);
    if (contractEarly) {
      logId = await logUsage({
        userId: request.userId,
        blueprintId: request.blueprintId,
        triggerType: request.triggerType,
      sourceEngine: request.sourceEngine,
        promptName: contractEarly.name,
        promptVersion: contractEarly.version,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startTime,
        status: "rejected",
        fallbackReason: stabilityCheck.reason,
      }).catch(() => "");
      const fallback = getFallback(contractEarly.fallbackKey, request.facts ?? {}, request.stateVersion);
      await logFallbackUsage({
        triggerType: request.triggerType,
        promptName: contractEarly.name,
        reason: stabilityCheck.reason ?? "STABILITY_THROTTLE",
        userId: request.userId,
        bhudhiLogId: logId || undefined,
      }).catch(() => null);
      return {
        ok: true,
        output: fallback as BhudhiOutputEnvelope<T>,
        fallbackUsed: true,
        logId: logId ?? "",
        failureReason: stabilityCheck.reason,
      };
    }
    return { ok: false, fallbackUsed: true, logId: "", failureReason: stabilityCheck.reason };
  }

  const contract = resolvePromptContract(request);
  if (!contract) {
    exitAgentChain(chainId);
    logger.warn({ triggerType: request.triggerType }, "[BhudhiCore] Unregistered trigger type");
    return { ok: false, fallbackUsed: true, logId: "", failureReason: "Unregistered trigger type" };
  }

  if (FORBIDDEN_MODES.includes(contract.mode)) {
    exitAgentChain(chainId);
    logger.error({ mode: contract.mode, triggerType: request.triggerType }, "[BhudhiCore] Forbidden mode attempted");
    return { ok: false, fallbackUsed: true, logId: "", failureReason: "Forbidden Bhudhi mode" };
  }

  const usageCheck = await checkUsageAllowed({ userId: request.userId, triggerType: request.triggerType });
  if (!usageCheck.allowed) {
    logId = await logUsage({
      userId:        request.userId,
      blueprintId:   request.blueprintId,
      triggerType:   request.triggerType,
      sourceEngine:  request.sourceEngine,
      promptName:    contract.name,
      promptVersion: contract.version,
      inputTokens:   0,
      outputTokens:  0,
      latencyMs:     Date.now() - startTime,
      status:        "rejected",
      fallbackReason: usageCheck.reason,
    }).catch(() => "");

    const fallback = getFallback(contract.fallbackKey, request.facts ?? {}, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: usageCheck.reason ?? "BUDGET_EXCEEDED",
      userId: request.userId,
      bhudhiLogId: logId || undefined,
    }).catch(() => null);
    exitAgentChain(chainId);
    return {
      ok:            true,
      output:        fallback as BhudhiOutputEnvelope<T>,
      fallbackUsed:  true,
      logId:         logId ?? "",
      failureReason: usageCheck.reason,
    };
  }

  let aiEnabled = true;
  try {
    const [aiFlag] = await db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.feature_name, "ai_enabled"))
      .limit(1);
    aiEnabled = aiFlag?.enabled ?? true;
  } catch {
    aiEnabled = true;
  }

  if (!aiEnabled) {
    logId = await logUsage({
      userId:        request.userId,
      blueprintId:   request.blueprintId,
      triggerType:   request.triggerType,
      sourceEngine:  request.sourceEngine,
      promptName:    contract.name,
      promptVersion: contract.version,
      inputTokens:   0,
      outputTokens:  0,
      latencyMs:     Date.now() - startTime,
      status:        "fallback",
      fallbackReason: "ai_disabled",
    }).catch(() => "");

    const fallback = getFallback(contract.fallbackKey, request.facts ?? {}, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: "ai_disabled",
      userId: request.userId,
      bhudhiLogId: logId || undefined,
    }).catch(() => null);
    exitAgentChain(chainId);
    return { ok: true, output: fallback as BhudhiOutputEnvelope<T>, fallbackUsed: true, logId: logId ?? "" };
  }

  let memoryContext = "";
  let unifiedMemoryContext = "";
  if (contract.memoryAllowed) {
    try {
      const graphMemory = await memoryGraph.queryForContext(request.blueprintId);
      if (graphMemory) unifiedMemoryContext = graphMemory;
    } catch {
      /* graph optional */
    }
    try {
      memoryContext = await retrieveMemory({
        userId:      request.userId,
        blueprintId: request.blueprintId,
        triggerType: request.triggerType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ msg }, "[BhudhiCore] Memory retrieval failed — continuing without memory");
      memoryContext = "";
    }
    if (unifiedMemoryContext && memoryContext) {
      memoryContext = `${unifiedMemoryContext} | ${memoryContext}`.slice(0, 800);
    } else if (unifiedMemoryContext) {
      memoryContext = unifiedMemoryContext;
    }
  }

  let beliefContext = "";
  try {
    const beliefs = await beliefEngine.process({
      blueprintId: request.blueprintId,
      userId: request.userId,
      trigger: request.triggerType,
      memory: memoryContext || undefined,
      signals: request.facts?.signals as Record<string, unknown> | undefined,
      research: request.facts?.research as Record<string, unknown> | undefined,
      simulation: request.facts?.simulation as Record<string, unknown> | undefined,
      decision: request.facts?.decision as Record<string, unknown> | undefined,
      feedback: request.facts?.feedback as Record<string, unknown> | undefined,
    });
    beliefContext = beliefEngine.formatBeliefContext(beliefs);
    if (beliefs.drift?.action === "governance") {
      logger.warn(
        { blueprintId: request.blueprintId, drift: beliefs.drift },
        "[BhudhiCore] Belief drift detected — governance may be required",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Belief processing skipped — continuing");
  }

  let worldContext = "";
  try {
    const world = await worldEngine.sync({
      blueprintId: request.blueprintId,
      userId: request.userId,
      trigger: request.triggerType,
      memory: memoryContext || undefined,
      signals: request.facts?.signals as Record<string, unknown> | undefined,
      conditions: request.facts?.conditions as Record<string, unknown> | undefined,
      blueprint: request.facts?.blueprint as Record<string, unknown> | undefined,
      life: request.facts?.life as Record<string, unknown> | undefined,
      simulation: request.facts?.simulation as Record<string, unknown> | undefined,
      feedback: request.facts?.feedback as Record<string, unknown> | undefined,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
    });
    worldContext = worldEngine.formatWorldContext(world);
    if (world.sync?.drift) {
      logger.warn(
        { blueprintId: request.blueprintId, sync: world.sync },
        "[BhudhiCore] World reality drift detected",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] World model sync skipped — continuing");
  }

  let identityContext = "";
  try {
    const identity = await identityEngine.process({
      blueprintId: request.blueprintId,
      userId: request.userId,
      trigger: request.triggerType,
      memory: memoryContext || undefined,
      signals: request.facts?.signals as Record<string, unknown> | undefined,
      blueprint: request.facts?.blueprint as Record<string, unknown> | undefined,
      life: request.facts?.life as Record<string, unknown> | undefined,
      beliefs: request.facts?.beliefs as Record<string, unknown> | undefined,
      world: request.facts?.world as Record<string, unknown> | undefined,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
      feedback: request.facts?.feedback as Record<string, unknown> | undefined,
      history: request.facts?.history as Record<string, unknown> | undefined,
    });
    identityContext = identityEngine.formatIdentityContext(identity);
    if (identity.drift?.action === "escalate" || identity.drift?.action === "pause") {
      logger.warn(
        { blueprintId: request.blueprintId, drift: identity.drift },
        "[BhudhiCore] Identity drift — personalization guard active",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Identity processing skipped — continuing");
  }

  let organizationContext = "";
  try {
    const org = await organizationEngine.process({
      blueprintId: request.blueprintId,
      name: "Blueprint Organization",
      users: [{ userId: request.userId, role: "OWNER", department: "strategy" }],
      strategy: (request.facts?.strategy as Record<string, unknown> | undefined) ?? {
        vision: "Blueprint execution",
      },
      projects: Array.isArray(request.facts?.projects)
        ? (request.facts.projects as Array<{
            id: string;
            name: string;
            ownerId?: string;
            status?: string;
          }>)
        : undefined,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
      world: request.facts?.world as Record<string, unknown> | undefined,
      identity: request.facts?.identity as Record<string, unknown> | undefined,
      signals: request.facts?.signals as Record<string, unknown> | undefined,
    });
    organizationContext = organizationEngine.formatOrganizationContext(org);
    if (org.health.action === "escalate") {
      logger.warn(
        { blueprintId: request.blueprintId, health: org.health },
        "[BhudhiCore] Organization health — escalate",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Organization OS skipped — continuing");
  }

  let teamContext = "";
  try {
    const team = await teamEngine.create({
      blueprintId: request.blueprintId,
      name: "Blueprint Team",
      members: [
        { userId: request.userId, role: "OWNER" },
        { userId: "bhudhi-agent", role: "ASSISTANT", isAgent: true },
      ],
      identity: request.facts?.identity as Record<string, unknown> | undefined,
      projects: Array.isArray(request.facts?.projects)
        ? (request.facts.projects as Array<{ id: string; name: string; ownerId?: string; status?: string }>)
        : undefined,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
      organization: request.facts?.organization as Record<string, unknown> | undefined,
    });
    teamContext = teamEngine.formatTeamContext(team);
    if (team.health?.action === "escalate") {
      logger.warn(
        { blueprintId: request.blueprintId, health: team.health },
        "[BhudhiCore] Team health — escalate",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Team engine skipped — continuing");
  }

  let erectorContext = "";
  try {
    const simulation = await erectorRuntime.create({
      blueprintId: request.blueprintId,
      goal: request.triggerType,
      validation: request.facts?.validation as Record<string, unknown> | undefined,
      blueprint: request.facts?.blueprint as Record<string, unknown> | undefined,
      world: request.facts?.world as Record<string, unknown> | undefined,
      identity: request.facts?.identity as Record<string, unknown> | undefined,
      time: request.facts?.temporal as Record<string, unknown> | undefined,
      constraints: request.facts?.constraints as string[] | undefined,
      seed: request.blueprintId,
      mode: "STANDARD",
      scenario: "realistic",
    });
    erectorContext = erectorRuntime.formatErectorContext(simulation);
    if (!simulation.outcomes.survived) {
      logger.warn(
        { blueprintId: request.blueprintId, simulationId: simulation.simulationId },
        "[BhudhiCore] Erector — synthetic reality did not survive pressure",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Erector runtime skipped — continuing");
  }

  let civilizationContext = "";
  try {
    const civilization = await civilizationEngine.create({
      blueprintId: request.blueprintId,
      world: request.facts?.world as Record<string, unknown> | undefined,
      economy: request.facts?.economicsPlan as Record<string, unknown> | undefined,
      teams: Array.isArray(request.facts?.teams)
        ? (request.facts.teams as Array<Record<string, unknown>>)
        : [{ name: "Blueprint Team" }],
      organizations: request.facts?.organization
        ? [request.facts.organization as Record<string, unknown>]
        : [{ name: "Blueprint Organization" }],
      time: request.facts?.temporal as Record<string, unknown> | undefined,
      simulation: request.facts?.simulation as Record<string, unknown> | undefined,
      seed: request.blueprintId,
    });
    civilizationContext = civilizationEngine.formatCivilizationContext(civilization);
    if (civilization.evolutionMode === "collapsing") {
      logger.warn(
        { blueprintId: request.blueprintId, civilizationId: civilization.civilizationId },
        "[BhudhiCore] Civilization — collapsing trajectory advisory",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Civilization engine skipped — continuing");
  }

  let temporalContext = "";
  try {
    const temporal = await temporalEngine.analyze({
      blueprintId: request.blueprintId,
      goal: request.triggerType,
      world: request.facts?.world as Record<string, unknown> | undefined,
      identity: request.facts?.identity as Record<string, unknown> | undefined,
      life: request.facts?.life as Record<string, unknown> | undefined,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
      signals: request.facts?.signals as Record<string, unknown> | undefined,
      memory: memoryContext || undefined,
    });
    temporalContext = temporalEngine.formatTemporalContext(temporal);
    if (temporal.window.window === "avoid" && temporal.urgency > 0.7) {
      logger.warn(
        { blueprintId: request.blueprintId, urgency: temporal.urgency },
        "[BhudhiCore] Temporal avoid window with high urgency",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Temporal engine skipped — continuing");
  }

  let governorContext = "";
  try {
    const governor = await metaGovernor.observe({
      blueprintId: request.blueprintId,
      world: request.facts?.world as Record<string, unknown> | undefined,
      beliefs: request.facts?.beliefs as Record<string, unknown> | undefined,
      decisions: request.facts?.decisions as Record<string, unknown> | undefined,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
      economics: request.facts?.economicsPlan as Record<string, unknown> | undefined,
      identity: request.facts?.identity as Record<string, unknown> | undefined,
      organization: request.facts?.organization as Record<string, unknown> | undefined,
      time: { urgency: request.facts?.temporalUrgency },
    });
    governorContext = metaGovernor.formatGovernorContext(governor);
    if (governor.health?.systemHealth === "critical") {
      logger.warn(
        { blueprintId: request.blueprintId, health: governor.health },
        "[BhudhiCore] Meta governor — system health critical",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Meta governor skipped — continuing");
  }

  let expansionContext = "";
  try {
    const expansion = await expansionEngine.discover({
      blueprintId: request.blueprintId,
      world: request.facts?.world as Record<string, unknown> | undefined,
      decisions: request.facts?.decisions as Record<string, unknown> | undefined,
      beliefs: request.facts?.beliefs as Record<string, unknown> | undefined,
      experiments: request.facts?.experiments as Record<string, unknown> | undefined,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
      memory: memoryContext ? { context: memoryContext } : undefined,
      results: request.facts?.results as Record<string, unknown> | undefined,
      seed: request.blueprintId,
    });
    expansionContext = expansionEngine.formatExpansionContext(expansion);
    if (expansion.risk > 0.75 && !expansion.approval) {
      logger.warn(
        { blueprintId: request.blueprintId, risk: expansion.risk },
        "[BhudhiCore] Expansion — high-risk capability candidates require governance",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Expansion engine skipped — continuing");
  }

  let infrastructureContext = "";
  try {
    const infrastructure = await infrastructureEngine.observe({
      blueprintId: request.blueprintId,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
      economics: request.facts?.economicsPlan as Record<string, unknown> | undefined,
      traffic: request.facts?.traffic as Record<string, unknown> | undefined,
      security: request.facts?.security as Record<string, unknown> | undefined,
      world: request.facts?.world as Record<string, unknown> | undefined,
      governor: request.facts?.governor as Record<string, unknown> | undefined,
    });
    infrastructureContext = infrastructureEngine.formatInfrastructureContext(infrastructure);
    if (!infrastructure.capacity.canSupport) {
      logger.warn(
        { blueprintId: request.blueprintId, capacity: infrastructure.capacity },
        "[BhudhiCore] Infrastructure capacity constrained",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Infrastructure engine skipped — continuing");
  }

  let securityContext = "";
  try {
    const security = await securityEngine.verify({
      blueprintId: request.blueprintId,
      actorId: request.userId,
      identity: {
        userId: request.userId,
        verified: true,
        role: request.facts?.role ?? "user",
      },
      governance: request.facts?.governance as Record<string, unknown> | undefined,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
      world: request.facts?.world as Record<string, unknown> | undefined,
      organization: request.facts?.organization as Record<string, unknown> | undefined,
      capabilities: Array.isArray(request.facts?.capabilities)
        ? (request.facts.capabilities as Array<{
            capability: string;
            level: "PUBLIC" | "LIMITED" | "PRIVILEGED" | "CRITICAL" | "IMMUTABLE";
            scope?: string;
          }>)
        : [{ capability: "bhudhi.invoke", level: "LIMITED", scope: request.blueprintId }],
      requestedPermission: "execute",
    });
    securityContext = securityEngine.formatSecurityContext(security);
    if (security.decision === "deny") {
      logger.warn(
        { blueprintId: request.blueprintId, decision: security.decision },
        "[BhudhiCore] Security — default deny triggered",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Security engine skipped — continuing");
  }

  let reliabilityContext = "";
  try {
    const reliability = await reliabilityEngine.check({
      blueprintId: request.blueprintId,
      execution: request.facts?.execution as Record<string, unknown> | undefined,
      world: request.facts?.world as Record<string, unknown> | undefined,
      decision: request.facts?.decisions as Record<string, unknown> | undefined,
      economics: request.facts?.economicsPlan as Record<string, unknown> | undefined,
      memory: memoryContext ? { context: memoryContext } : undefined,
      simulation: request.facts?.simulation as Record<string, unknown> | undefined,
      governance: request.facts?.governance as Record<string, unknown> | undefined,
    });
    reliabilityContext = reliabilityEngine.formatReliabilityContext(reliability);
    if (reliability.continuityMode === "OFFLINE" || reliability.failureProbability > 0.8) {
      logger.warn(
        { blueprintId: request.blueprintId, reliability },
        "[BhudhiCore] Reliability — elevated failure risk",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Reliability engine skipped — continuing");
  }

  const facts: Record<string, unknown> = {
    ...request.facts,
    stateVersion: request.stateVersion,
    userInput:    request.userInput,
    memoryContext,
    beliefContext,
    worldContext,
    identityContext,
    organizationContext,
    teamContext,
    erectorContext,
    civilizationContext,
    temporalContext,
    governorContext,
    expansionContext,
    infrastructureContext,
    securityContext,
    reliabilityContext,
  };

  let economicsSessionId = "";
  let economicsMaxTokens: number | undefined;

  try {
    const economics = await economicsEngine.applyBeforeInvoke({
      userId: request.userId,
      blueprintId: request.blueprintId,
      triggerType: request.triggerType,
      task: request.triggerType,
      trigger: request.triggerType,
      confidence:
        typeof request.facts?.confidence === "number"
          ? request.facts.confidence
          : undefined,
      memoryBytes: memoryContext.length > 0 ? memoryContext.length : undefined,
      simulation: Boolean(request.facts?.simulation),
      priority:
        request.facts?.priority === "critical" ||
        request.facts?.priority === "high" ||
        request.facts?.priority === "low"
          ? request.facts.priority
          : "normal",
    });

    if (economics.blocked) {
      exitAgentChain(chainId);
      const fallback = getFallback(contract.fallbackKey, facts, request.stateVersion);
      await logFallbackUsage({
        triggerType: request.triggerType,
        promptName: contract.name,
        reason: economics.plan.blockReason ?? "economics_blocked",
        userId: request.userId,
      }).catch(() => null);
      return {
        ok: true,
        output: fallback as BhudhiOutputEnvelope<T>,
        fallbackUsed: true,
        logId: "",
        failureReason: economics.plan.blockReason ?? "economics_blocked",
      };
    }

    economicsSessionId = economics.sessionId;
    economicsMaxTokens = economics.maxTokens;
    facts.economicsPlan = {
      route: economics.plan.compute.route,
      executionMode: economics.plan.compute.executionMode,
      modelId: economics.plan.compute.modelId,
      valueScore: economics.plan.compute.valueScore,
      roiAction: economics.plan.roi.action,
    };
  } catch (err) {
    logger.warn({ err }, "[BhudhiCore] Economics planning skipped — continuing");
  }

  const provider: BhudhiProvider = contract.provider ?? providerForTrigger(request.triggerType);

  try {
    logId = await logUsage({
      userId:        request.userId,
      blueprintId:   request.blueprintId,
      triggerType:   request.triggerType,
      sourceEngine:  request.sourceEngine,
      promptName:    contract.name,
      promptVersion: contract.version,
      provider,
      inputTokens:   0,
      outputTokens:  0,
      latencyMs:     0,
      status:        "pending",
      fallbackReason: undefined,
      errorCode:     undefined,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[BhudhiCore] BhudhiLog write failed — aborting call (fail closed)",
    );
    const fallback = getFallback(contract.fallbackKey, facts, request.stateVersion);
    return { ok: true, output: fallback as BhudhiOutputEnvelope<T>, fallbackUsed: true, logId: "" };
  }

  const timeout = getTimeout(request.triggerType);
  let rawOutput: unknown = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let webSearchCalls = 0;
  let intelligenceGrounded = false;

  try {
    let userPrompt = contract.buildUserPrompt(facts);
    if (ERECTOR_SEARCH_TRIGGERS.has(request.triggerType)) {
      userPrompt = appendErectorSearchUserPrompt(request.triggerType, facts, userPrompt);
    }

    const apiKey =
      process.env["ANTHROPIC_API_KEY"]?.trim() ||
      process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]?.trim();
    if (!apiKey) {
      throw new Error("BHUDHI_NO_API_KEY");
    }

    const maxTokens = Math.min(
      economicsMaxTokens ?? contract.maxTokens,
      contract.maxTokens,
      getMaxTokensForTrigger(request.triggerType),
    );
    const systemPrompt = ERECTOR_SEARCH_TRIGGERS.has(request.triggerType)
      ? appendWebSearchInstruction(request.triggerType, contract.systemPrompt)
      : contract.systemPrompt;

    const invokeParams = {
      provider,
      systemPrompt,
      userPrompt,
      maxTokens,
      temperature: contract.temperature,
      timeoutMs: timeout,
    };

    const parseModelText = (text: string): unknown => {
      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      return JSON.parse(cleaned) as unknown;
    };

    let modelResult = await deps.invokeModel(invokeParams);
    if (!modelResult?.text) {
      throw new Error("BHUDHI_MODEL_EMPTY");
    }

    inputTokens = modelResult.inputTokens;
    outputTokens = modelResult.outputTokens;
    webSearchCalls = modelResult.webSearchCalls;
    intelligenceGrounded = modelResult.intelligenceGrounded;

    try {
      rawOutput = parseModelText(modelResult.text);
    } catch {
      modelResult = await deps.invokeModel(invokeParams);
      if (!modelResult?.text) throw new Error("BHUDHI_JSON_PARSE");
      rawOutput = parseModelText(modelResult.text);
    }

    if (contract.outputSchema) {
      const zodParsed = contract.outputSchema.safeParse(rawOutput);
      if (!zodParsed.success) {
        throw new Error(
          `Schema validation failed: ${zodParsed.error.issues.map((i) => i.message).join(", ")}`,
        );
      }
      rawOutput = zodParsed.data;
    }
  } catch (error) {
    const errMsg  = error instanceof Error ? error.message : String(error);
    const latency = Date.now() - startTime;

    await updateBhudhiLog({
      logId,
      inputTokens,
      outputTokens,
      latencyMs: latency,
      status: errMsg === "BHUDHI_TIMEOUT" ? "fallback" : "error",
      fallbackReason: errMsg,
      errorCode: errMsg,
    }).catch(() => null);

    const fallback = getFallback(contract.fallbackKey, facts, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: errMsg,
      userId: request.userId,
      bhudhiLogId: logId || undefined,
    }).catch(() => null);
    exitAgentChain(chainId);
    return {
      ok:            true,
      output:        fallback as BhudhiOutputEnvelope<T>,
      fallbackUsed:  true,
      logId,
      failureReason: errMsg,
    };
  }

  const validation = validateOutput(rawOutput, contract.outputType, request.stateVersion);
  const latency    = Date.now() - startTime;

  if (!validation.ok) {
    await updateBhudhiLog({
      logId,
      inputTokens,
      outputTokens,
      latencyMs: latency,
      status: "fallback",
      fallbackReason: `Validation failed: ${validation.errors.join(", ")}`,
    }).catch(() => null);

    const fallback = getFallback(contract.fallbackKey, facts, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: `Validation failed: ${validation.errors.join(", ")}`,
      userId: request.userId,
      bhudhiLogId: logId,
    }).catch(() => null);
    exitAgentChain(chainId);
    return { ok: true, output: fallback as BhudhiOutputEnvelope<T>, fallbackUsed: true, logId };
  }

  const agents = getActiveAgentsForTrigger(request.triggerType);
  const producingAgent = agents[0] ?? request.sourceEngine;

  const critic = await reviewOutput({
    output: rawOutput,
    producingAgent,
    triggerType: request.triggerType,
    promptContract: contract.name,
    userId: request.userId,
    worldStateVersion: request.stateVersion,
    bhudhiLogId: logId,
  });

  if (critic.verdict === "REJECTED") {
    await updateBhudhiLog({
      logId,
      inputTokens,
      outputTokens,
      latencyMs: latency,
      status: "rejected",
      fallbackReason: critic.rejectionReason ?? "Critic rejected",
      outputJson: { governanceViolation: critic.governanceViolation },
    }).catch(() => null);

    const fallback = getFallback(contract.fallbackKey, facts, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: critic.rejectionReason ?? "CRITIC_REJECTED",
      userId: request.userId,
      bhudhiLogId: logId,
    }).catch(() => null);
    exitAgentChain(chainId);
    return {
      ok: true,
      output: fallback as BhudhiOutputEnvelope<T>,
      fallbackUsed: true,
      logId,
      failureReason: critic.rejectionReason,
    };
  }

  const estimatedCostUsd = inputTokens * 0.000003 + outputTokens * 0.000015;

  await updateBhudhiLog({
    logId,
    inputTokens,
    outputTokens,
    latencyMs: latency,
    status: "success",
    outputJson: {
      confidenceTier: critic.confidenceTier,
      criticFlag: critic.flagReason,
      web_search_calls: webSearchCalls,
      intelligence_grounded: intelligenceGrounded,
      estimated_cost_usd: estimatedCostUsd,
    },
  }).catch(() => null);

  if (economicsSessionId) {
    await economicsEngine
      .recordInvokeResult(economicsSessionId, {
        costUsd: estimatedCostUsd,
        latencyMs: latency,
        tokensIn: inputTokens,
        tokensOut: outputTokens,
      })
      .catch(() => null);
  }

  incrementSessionOutput(request.userId);
  exitAgentChain(chainId);

  logger.info(
    { triggerType: request.triggerType, userId: request.userId, latency, tokens: inputTokens + outputTokens },
    "[BhudhiCore] Call completed",
  );

  const envelope = rawOutput as BhudhiOutputEnvelope<T>;
  if (envelope && typeof envelope === "object") {
    (envelope as BhudhiOutputEnvelope).confidence = critic.confidenceTier;
  }

  return {
    ok:           true,
    output:       rawOutput as BhudhiOutputEnvelope<T>,
    fallbackUsed: false,
    logId,
  };
}

/** @deprecated Prefer {@link routeBhudhiRequest} from TriggerRouter. Legacy adapter for older routes. */
export class BhudhiCore {
  async call(req: import("../types/bhudhi.js").BhudhiRequest): Promise<import("../types/bhudhi.js").BhudhiResponse> {
    const start = Date.now();
    logger.warn({ trigger: req.trigger }, "[BhudhiCore.call] deprecated — use routeBhudhiRequest()");
    return {
      trigger:      req.trigger,
      output:       {},
      model:        BHUDHI_MODEL,
      tokensUsed:   0,
      latencyMs:    Date.now() - start,
      valid:        false,
      fallbackUsed: true,
    };
  }
}

// Re-export for call sites that log manually
export { mapBhudhiTriggerToDbEnum } from "./bhudhiLogMapping.js";