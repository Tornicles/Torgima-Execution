/**
 * BHUDHI_CURSOR_PROMPT_4 — Critic, Stability, Debate, Meta-Cognition, Fallbacks
 */
import { describe, it, expect, beforeEach } from "vitest";
import { reviewOutput } from "../../../bhudhi/agents/CriticAgent.js";
import {
  checkTriggerAllowed,
  enterAgentChain,
  breakCircuit,
  resetStabilityStateForTests,
} from "../../../engines/stability/StabilityEngine.js";
import { shouldTriggerDebate, runDebate, escalateAgentConflict } from "../../../bhudhi/DebateEngine.js";
import {
  getAgentConfidenceTier,
  recordPrediction,
  recordOutcome,
  generateUncertaintyDisclosure,
} from "../../../engines/meta/MetaCognitionEngine.js";
import {
  getFallbackCoverageReport,
  validateFallbackForContract,
  getDeterministicFallback,
} from "../../../bhudhi/FallbackRegistry.js";
import { validateOutput } from "../../../bhudhi/OutputValidator.js";
import { fallbackTestContext } from "../../../bhudhi/fallbackTestContext.js";
import { getAllContracts } from "../../../bhudhi/PromptRegistry.js";
import { integrationEnabled } from "../../helpers/db.js";

const integration = integrationEnabled();

beforeEach(() => {
  resetStabilityStateForTests();
});

describe("Prompt 4 — Critic Agent", () => {
  it("TEST 1: rejects governance violation (set_condition)", async () => {
    const result = await reviewOutput({
      output: {
        outputType: "state_explanation",
        contractVersion: "1.0",
        stateVersion: 0,
        confidence: "HIGH",
        forbiddenActionRequested: false,
        missingFields: [],
        warnings: [],
        data: { explanation: "set_condition: Stability has been assigned for you" },
      },
      producingAgent: "TASK_GENERATION",
      triggerType: "STATE_EXPLANATION",
      promptContract: "state.explain.v1",
      userId: "00000000-0000-4000-8000-000000000010",
      worldStateVersion: 0,
    });
    expect(result.verdict).toBe("REJECTED");
    expect(result.governanceViolation).toBe(true);
  });

  it("TEST 2: rejects schema failure for task_copy", async () => {
    const result = await reviewOutput({
      output: {
        outputType: "task_copy",
        contractVersion: "1.0",
        stateVersion: 0,
        confidence: "MEDIUM",
        forbiddenActionRequested: false,
        data: {},
      },
      producingAgent: "TASK_GENERATION",
      triggerType: "TASK_DRAFTING",
      promptContract: "task.draft.command.v2",
      userId: "00000000-0000-4000-8000-000000000011",
      worldStateVersion: 0,
    });
    expect(result.verdict).toBe("REJECTED");
    expect(result.rejectionReason).toMatch(/schema/i);
  });

  it("TEST 3: assigns confidence tier on valid task draft", async () => {
    const result = await reviewOutput({
      output: {
        outputType: "task_copy",
        contractVersion: "1.0",
        stateVersion: 0,
        confidence: "MEDIUM",
        forbiddenActionRequested: false,
        missingFields: [],
        warnings: [],
        data: {
          title: "Ship feature slice",
          instruction: "Complete the scoped task and submit proof.",
          successCriteria: ["Done when proof uploaded"],
          estimatedEffortLabel: "MEDIUM",
          userFacingReason: "Advances active blueprint",
        },
      },
      producingAgent: "TASK_GENERATION",
      triggerType: "TASK_DRAFTING",
      promptContract: "task.draft.command.v2",
      userId: "00000000-0000-4000-8000-000000000012",
      worldStateVersion: 0,
    });
    expect(["APPROVED", "APPROVED_WITH_FLAG"]).toContain(result.verdict);
    expect(result.confidenceTier).toBeTruthy();
  });

  it("TEST 4: approves valid structured goal flow", async () => {
    const result = await reviewOutput({
      output: {
        outputType: "structured_goal",
        contractVersion: "1.0",
        stateVersion: 0,
        confidence: "HIGH",
        forbiddenActionRequested: false,
        missingFields: [],
        warnings: [],
        data: {
          cleanedGoal: "Reach $5k MRR with B2B SaaS in 12 months",
          purpose: "Revenue",
          timeframe: "12 months",
          commitmentLevel: "HIGH",
          domainHints: [],
          ambiguityFlags: [],
          missingRequiredFields: [],
        },
      },
      producingAgent: "STRATEGY",
      triggerType: "GOAL_STRUCTURING",
      promptContract: "goal.structure.v1",
      userId: "00000000-0000-4000-8000-000000000013",
      worldStateVersion: 0,
    });
    expect(result.verdict).toBe("APPROVED");
  });
});

describe("Prompt 4 — Debate loop", () => {
  it("TEST 5: shouldTriggerDebate on low feasibility", () => {
    expect(shouldTriggerDebate({ triggerType: "REALITY_INTELLIGENCE", feasibilityScore: 0.3 })).toBe(
      true,
    );
  });

  it("TEST 5b: runDebate produces verdict", async () => {
    const result = await runDebate({
      topic: "Direction for declining market entry",
      userId: "00000000-0000-4000-8000-000000000020",
      triggerType: "REALITY_INTELLIGENCE",
      contextPacket: { goal: "Launch in saturated niche", stateVersion: 0, feasibilityScore: 0.3 },
      debateType: "HIGH_RISK_VALIDATION",
      feasibilityScore: 0.3,
    });
    expect(result.judgeRationale).toBeTruthy();
    expect(result.finalVerdict).toBeTruthy();
  });

  it.runIf(integration)("TEST 6: agent conflict escalation creates logs", async () => {
    const { db, agentConflictLogs, debateLogs } = await import("@workspace/db");
    const { eq, desc } = await import("drizzle-orm");
    const userId = "00000000-0000-4000-8000-000000000021";

    const result = await escalateAgentConflict({
      userId,
      triggerType: "REALITY_INTELLIGENCE",
      agentA: "STRATEGY",
      agentB: "BEHAVIORAL",
      outputA: { position: "proceed aggressively" },
      outputB: { position: "pivot to niche" },
    });

    expect(result.judgeRationale).toBeTruthy();

    const conflicts = await db
      .select()
      .from(agentConflictLogs)
      .where(eq(agentConflictLogs.user_id, userId))
      .orderBy(desc(agentConflictLogs.created_at))
      .limit(1);
    expect(conflicts.length).toBe(1);
    expect(["JUDGE_DECIDED", "CRITIC_DECIDED"]).toContain(conflicts[0]!.resolution);

    const debates = await db
      .select()
      .from(debateLogs)
      .where(eq(debateLogs.user_id, userId))
      .orderBy(desc(debateLogs.created_at))
      .limit(1);
    expect(debates.length).toBe(1);
    expect(debates[0]!.judge_rationale).toBeTruthy();
  });
});

describe("Prompt 4 — Stability engine", () => {
  it("TEST 7: over-trigger rate limit", async () => {
    const userId = "00000000-0000-4000-8000-000000000030";
    const trigger = "GOAL_STRUCTURING";
    let blocked = false;
    for (let i = 0; i < 5; i++) {
      const r = await checkTriggerAllowed(trigger, userId);
      if (!r.allowed) blocked = true;
    }
    expect(blocked).toBe(true);
  });

  it("TEST 8: circuit breaker on deep chain", async () => {
    const chainId = "test-chain-deep";
    for (let i = 0; i < 6; i++) {
      enterAgentChain(chainId);
    }
    const last = enterAgentChain(chainId);
    expect(last.allowed).toBe(false);
    await breakCircuit(chainId, "test depth exceeded");
  });
});

describe("Prompt 4 — Meta-cognition", () => {
  it.runIf(integration)("TEST 9-10: prediction accuracy and uncertainty disclosure", async () => {
    const userId = "00000000-0000-4000-8000-000000000040";
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push(
        await recordPrediction({
          agentName: "STRATEGY",
          predictionType: "feasibility",
          prediction: { score: 0.5 + i * 0.01 },
          confidenceLevel: 0.6,
          userId,
        }),
      );
    }
    for (let i = 0; i < 5; i++) {
      await recordOutcome(ids[i]!, { score: 0.5 + i * 0.01 });
    }

    const tier = await getAgentConfidenceTier("STRATEGY", "unknown_domain", "feasibility");
    const disclosure = await generateUncertaintyDisclosure("STRATEGY", "unknown_domain", tier);
    if (tier === "LOW") {
      expect(disclosure).toBeTruthy();
    } else {
      expect(tier).toMatch(/HIGH|MEDIUM|LOW/);
    }
  });
});

describe("Prompt 4 — Self-improvement", () => {
  it.runIf(integration)("TEST 11: daily evaluation updates agent quality", async () => {
    const { db, agentRegistry, criticReviewLogs } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const { runDailyEvaluation } = await import("../../../bhudhi/agents/SelfImprovementAgent.js");
    const { createTestUser, cleanupTestUser } = await import("../../helpers/db.js");

    const user = await createTestUser();
    const agentName = "TASK_GENERATION";

    await db
      .insert(agentRegistry)
      .values({
        agent_name: agentName,
        status: "ACTIVE",
        activation_phase: "P1",
        trigger_types: ["TASK_DRAFTING"],
        output_contract: "task_copy",
        quality_score: 0.8,
      })
      .onConflictDoUpdate({
        target: agentRegistry.agent_name,
        set: { quality_score: 0.8 },
      });

    const { logUsage } = await import("../../../bhudhi/UsageController.js");
    for (let i = 0; i < 3; i++) {
      const logId = await logUsage({
        userId: user.id,
        triggerType: "TASK_DRAFTING",
        promptName: "task.draft.command.v2",
        promptVersion: "2.0",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 1,
        status: "rejected",
      });
      await db.insert(criticReviewLogs).values({
        bhudhi_log_id: logId,
        user_id: user.id,
        input_agent: agentName,
        verdict: "REJECTED",
        confidence_score: 0.2,
        confidence_tier: "LOW",
        rejection_reason: "schema test",
        governance_violation: false,
        revision_count: 0,
      });
    }

    await runDailyEvaluation(user.id);

    const [row] = await db
      .select()
      .from(agentRegistry)
      .where(eq(agentRegistry.agent_name, agentName))
      .limit(1);

    expect(row?.quality_score).toBeLessThan(0.8);
    await cleanupTestUser(user.id);
  });
});

describe("Prompt 4 — Fallback registry", () => {
  it("TEST 12: all registered contracts have valid fallbacks", () => {
    const report = getFallbackCoverageReport();
    expect(report.total).toBeGreaterThanOrEqual(14);
    expect(report.covered).toBe(report.total);
    expect(report.missing).toEqual([]);

    for (const [triggerType, contract] of getAllContracts()) {
      const v = validateFallbackForContract(
        triggerType,
        contract.fallbackKey,
        fallbackTestContext(triggerType),
        0,
      );
      expect(v.ok, `${triggerType}: ${v.errors.join("; ")}`).toBe(true);
    }
  });

  it("TEST 13: offline fallbacks support feedback → task execution chain", () => {
    const ctx = fallbackTestContext("FEEDBACK_CLASSIFICATION");
    const feedback = getDeterministicFallback("fallback.blocker_classification", ctx, 0);
    const feedbackValid = validateOutput(feedback, "blocker_classification", 0);
    expect(feedbackValid.ok).toBe(true);

    const task = getDeterministicFallback("fallback.task_copy", fallbackTestContext("TASK_DRAFTING"), 0);
    const taskValid = validateOutput(task, "task_copy", 0);
    expect(taskValid.ok).toBe(true);
    expect(task.outputType).toBe("task_copy");
  });

  it.runIf(integration)("TEST 13b: BhudhiCore uses fallback when API key absent", async () => {
    const prevKey = process.env.ANTHROPIC_API_KEY;
    const prevAlt = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

    const { routeBhudhiRequest } = await import("../../../bhudhi/TriggerRouter.js");
    const { createTestUser, cleanupTestUser } = await import("../../helpers/db.js");
    const user = await createTestUser();

    const result = await routeBhudhiRequest({
      userId: user.id,
      triggerType: "TASK_DRAFTING",
      stateVersion: 0,
      facts: fallbackTestContext("TASK_DRAFTING"),
      sourceEngine: "test",
      idempotencyKey: `test-offline-${user.id}`,
    });

    if (prevKey) process.env.ANTHROPIC_API_KEY = prevKey;
    if (prevAlt) process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = prevAlt;

    expect(result.ok).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.output?.outputType).toBe("task_copy");
    await cleanupTestUser(user.id);
  });
});

describe("Prompt 4 — Critic coverage", () => {
  it.runIf(integration)("TEST 14: BhudhiLog entries have critic reviews when log id set", async () => {
    const { db, bhudhiLogs, criticReviewLogs } = await import("@workspace/db");
    const { eq, desc } = await import("drizzle-orm");
    const { logUsage } = await import("../../../bhudhi/UsageController.js");
    const { reviewOutput: criticReview } = await import("../../../bhudhi/agents/CriticAgent.js");
    const { createTestUser, cleanupTestUser } = await import("../../helpers/db.js");

    const user = await createTestUser();
    const logId = await logUsage({
      userId: user.id,
      triggerType: "GOAL_STRUCTURING",
      promptName: "goal.structure.v1",
      promptVersion: "1.0",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 1,
      status: "success",
    });

    await criticReview({
      output: {
        outputType: "structured_goal",
        contractVersion: "1.0",
        stateVersion: 0,
        confidence: "HIGH",
        forbiddenActionRequested: false,
        missingFields: [],
        warnings: [],
        data: {
          cleanedGoal: "Test goal for critic coverage",
          purpose: "Test",
          timeframe: "90 days",
          commitmentLevel: "HIGH",
          domainHints: [],
          ambiguityFlags: [],
          missingRequiredFields: [],
        },
      },
      producingAgent: "STRATEGY",
      triggerType: "GOAL_STRUCTURING",
      promptContract: "goal.structure.v1",
      userId: user.id,
      worldStateVersion: 0,
      bhudhiLogId: logId,
    });

    const logs = await db
      .select({ id: bhudhiLogs.id })
      .from(bhudhiLogs)
      .where(eq(bhudhiLogs.user_id, user.id));

    const reviews = await db
      .select({ bhudhi_log_id: criticReviewLogs.bhudhi_log_id })
      .from(criticReviewLogs)
      .where(eq(criticReviewLogs.user_id, user.id));

    const reviewedIds = new Set(reviews.map(r => r.bhudhi_log_id));
    expect(logs.some(row => row.id === logId && reviewedIds.has(row.id))).toBe(true);

    await cleanupTestUser(user.id);
  });
});
