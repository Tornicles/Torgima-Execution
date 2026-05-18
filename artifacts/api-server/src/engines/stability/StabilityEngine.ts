import { db, stabilityEvents } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import type { BhudhiTriggerType } from "../../types/bhudhi.js";

type RateKey = string;

const TRIGGER_RATE_LIMITS: Partial<Record<string, { maxPerMinute: number }>> = {
  GOAL_STRUCTURING: { maxPerMinute: 3 },
  BLUEPRINT_GENERATION: { maxPerMinute: 2 },
  TASK_DRAFTING: { maxPerMinute: 10 },
  FEEDBACK_CLASSIFICATION: { maxPerMinute: 20 },
  STATE_EXPLANATION: { maxPerMinute: 30 },
  OVERNIGHT_CYCLE: { maxPerMinute: 1 },
  WORLD_STATE_UPDATE: { maxPerMinute: 2 },
  DOMAIN_RESOLUTION: { maxPerMinute: 3 },
  REALITY_INTELLIGENCE: { maxPerMinute: 2 },
  EIS_INDUSTRY_RESEARCH: { maxPerMinute: 2 },
  KNOWLEDGE_INJECTION: { maxPerMinute: 15 },
  EXECUTION_SUPPORT: { maxPerMinute: 20 },
  COMPRESSION_CYCLE: { maxPerMinute: 1 },
  SELF_IMPROVEMENT_CYCLE: { maxPerMinute: 1 },
  BLUEPRINT_INTERPRETATION: { maxPerMinute: 5 },
  RECOVERY_COPY: { maxPerMinute: 5 },
  ACADEMY_SUPPORT: { maxPerMinute: 10 },
  ACADEMY_SKILL_ASSESSMENT: { maxPerMinute: 10 },
  ACADEMY_GAP_SEVERITY: { maxPerMinute: 10 },
  OUTCOME_EVIDENCE_SUMMARY: { maxPerMinute: 10 },
  ROOT_CAUSE_ASSIST: { maxPerMinute: 5 },
  CLARIFICATION_PROMPT: { maxPerMinute: 15 },
  INACTIVITY_RESTART: { maxPerMinute: 5 },
};

const DENSITY_LIMITS = {
  maxOutputsPerUserSession: 12,
  maxProactiveAlertsPerDay: 5,
  maxCascadeAlertDepth: 3,
  maxAgentChainDepth: 5,
};

const triggerWindow = new Map<RateKey, number[]>();
const sessionOutputCount = new Map<string, number>();
const chainDepth = new Map<string, number>();

function rateKey(trigger: string, userId: string): RateKey {
  return `${userId}:${trigger}`;
}

async function logStabilityEvent(params: {
  userId?: string;
  eventType: string;
  severity: string;
  description: string;
  agentInvolved?: string;
  triggerType?: string;
  resolution: string;
}): Promise<void> {
  await db
    .insert(stabilityEvents)
    .values({
      user_id: params.userId ?? null,
      event_type: params.eventType,
      severity: params.severity,
      description: params.description,
      agent_involved: params.agentInvolved,
      trigger_type: params.triggerType,
      resolution: params.resolution,
    })
    .catch(err => {
      logger.warn({ err }, "[StabilityEngine] Failed to log event");
    });
}

export async function checkTriggerAllowed(
  trigger: BhudhiTriggerType | string,
  userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const limit = TRIGGER_RATE_LIMITS[trigger]?.maxPerMinute ?? 30;
  const key = rateKey(trigger, userId);
  const now = Date.now();
  const windowMs = 60_000;
  const hits = (triggerWindow.get(key) ?? []).filter(t => now - t < windowMs);
  hits.push(now);
  triggerWindow.set(key, hits);

  if (hits.length > limit) {
    await logStabilityEvent({
      userId,
      eventType: "OVER_TRIGGER",
      severity: "HIGH",
      description: `Trigger ${trigger} exceeded ${limit}/min`,
      triggerType: trigger,
      resolution: "Throttled — fallback required",
    });
    return { allowed: false, reason: `Rate limit exceeded for ${trigger}` };
  }

  if (throttleIntelligenceDensity(userId, sessionOutputCount.get(userId) ?? 0)) {
    return { allowed: false, reason: "Intelligence density limit reached for session" };
  }

  return { allowed: true };
}

export function incrementSessionOutput(userId: string): void {
  sessionOutputCount.set(userId, (sessionOutputCount.get(userId) ?? 0) + 1);
}

export function throttleIntelligenceDensity(userId: string, sessionOutputCountValue: number): boolean {
  if (sessionOutputCountValue >= DENSITY_LIMITS.maxOutputsPerUserSession) {
    void logStabilityEvent({
      userId,
      eventType: "ALERT_THROTTLE",
      severity: "MEDIUM",
      description: "Session intelligence output cap reached",
      resolution: "Output suppressed per Silence Layer",
    });
    return true;
  }
  return false;
}

export async function detectAgentConflict(
  outputA: unknown,
  outputB: unknown,
  context: { triggerType: string; userId: string },
): Promise<{
  conflict: boolean;
  conflictType?: string;
  severity?: string;
  resolution?: string;
}> {
  const a = JSON.stringify(outputA).toLowerCase();
  const b = JSON.stringify(outputB).toLowerCase();
  const contradict =
    (a.includes("proceed") && b.includes("pivot")) ||
    (a.includes("declining") && b.includes("rising")) ||
    (a.includes("approve") && b.includes("reject"));

  if (!contradict) return { conflict: false };

  await logStabilityEvent({
    userId: context.userId,
    eventType: "AGENT_CONFLICT",
    severity: "HIGH",
    description: `Agent outputs conflict on ${context.triggerType}`,
    triggerType: context.triggerType,
    resolution: "Escalate to debate or critic",
  });

  return {
    conflict: true,
    conflictType: "CONTRADICTION",
    severity: "HIGH",
    resolution: "CRITIC_DECIDED",
  };
}

export function enterAgentChain(chainId: string): { depth: number; allowed: boolean } {
  const depth = (chainDepth.get(chainId) ?? 0) + 1;
  chainDepth.set(chainId, depth);
  if (depth > DENSITY_LIMITS.maxAgentChainDepth) {
    return { depth, allowed: false };
  }
  return { depth, allowed: true };
}

export function exitAgentChain(chainId: string): void {
  const depth = chainDepth.get(chainId) ?? 0;
  if (depth <= 1) chainDepth.delete(chainId);
  else chainDepth.set(chainId, depth - 1);
}

export async function breakCircuit(chainId: string, reason: string): Promise<void> {
  chainDepth.delete(chainId);
  await logStabilityEvent({
    eventType: "LOOP_DETECTED",
    severity: "CRITICAL",
    description: reason,
    resolution: "Circuit broken — fallback used",
  });
}

export async function getStabilityEventsForUser(
  userId: string,
  windowHours = 24,
): Promise<Array<typeof stabilityEvents.$inferSelect>> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const rows = await db.select().from(stabilityEvents);
  return rows.filter(r => r.user_id === userId && r.created_at >= since);
}

export function resetStabilityStateForTests(): void {
  triggerWindow.clear();
  sessionOutputCount.clear();
  chainDepth.clear();
}
