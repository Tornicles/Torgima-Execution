import { db, agentRegistry } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export type AgentName =
  | "STRATEGY"
  | "BLUEPRINT"
  | "TASK_GENERATION"
  | "BEHAVIORAL"
  | "PSYCHOLOGY"
  | "EIS"
  | "KNOWLEDGE"
  | "EXECUTION"
  | "SIMULATION"
  | "CRITIC"
  | "CONDITION"
  | "SELF_IMPROVEMENT"
  | "ECONOMIC";

export type AgentStatus = "ACTIVE" | "DORMANT" | "DISABLED";

export interface AgentDefinition {
  agentName: AgentName;
  status: AgentStatus;
  activationPhase: "P1" | "P2" | "P3";
  triggerTypes: string[];
  outputContract: string;
}

/** In-code registry (Prompt 1 §3.3) — DB `agent_registry` is seeded by migration. */
export const AGENT_REGISTRY: Record<AgentName, AgentDefinition> = {
  STRATEGY: {
    agentName: "STRATEGY",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["USER_GOAL_TRIGGER", "DOMAIN_RESOLUTION", "BLUEPRINT_INTERPRETATION"],
    outputContract: "goal.structure.v1",
  },
  BLUEPRINT: {
    agentName: "BLUEPRINT",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["BLUEPRINT_GENERATION", "BLUEPRINT_INTERPRETATION", "OVERNIGHT_CYCLE"],
    outputContract: "blueprint.generate.v1",
  },
  TASK_GENERATION: {
    agentName: "TASK_GENERATION",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["TASK_DRAFTING", "RECOVERY_COPY", "ACADEMY_SUPPORT"],
    outputContract: "task.draft.v1",
  },
  BEHAVIORAL: {
    agentName: "BEHAVIORAL",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["FEEDBACK_CLASSIFICATION", "OVERNIGHT_CYCLE", "WORLD_STATE_UPDATE"],
    outputContract: "feedback.classify_blocker.v1",
  },
  CRITIC: {
    agentName: "CRITIC",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["*"],
    outputContract: "state.explain.v1",
  },
  SELF_IMPROVEMENT: {
    agentName: "SELF_IMPROVEMENT",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["SELF_IMPROVEMENT_CYCLE", "COMPRESSION_CYCLE"],
    outputContract: "state.explain.v1",
  },
  EIS: {
    agentName: "EIS",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["OVERNIGHT_CYCLE"],
    outputContract: "reality_intelligence",
  },
  KNOWLEDGE: {
    agentName: "KNOWLEDGE",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["KNOWLEDGE_INJECTION", "ACADEMY_SUPPORT"],
    outputContract: "academy_instruction",
  },
  CONDITION: {
    agentName: "CONDITION",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["TASK_DRAFTING", "STATE_EXPLANATION"],
    outputContract: "state.explain.v1",
  },
  PSYCHOLOGY: {
    agentName: "PSYCHOLOGY",
    status: "ACTIVE",
    activationPhase: "P1",
    triggerTypes: ["BEHAVIORAL_ANALYSIS", "OVERNIGHT_CYCLE", "FEEDBACK_CLASSIFICATION"],
    outputContract: "psychology.identity_update.v1",
  },
  SIMULATION: {
    agentName: "SIMULATION",
    status: "DORMANT",
    activationPhase: "P2",
    triggerTypes: [],
    outputContract: "state.explain.v1",
  },
  ECONOMIC: {
    agentName: "ECONOMIC",
    status: "DORMANT",
    activationPhase: "P3",
    triggerTypes: [],
    outputContract: "state.explain.v1",
  },
  EXECUTION: {
    agentName: "EXECUTION",
    status: "DORMANT",
    activationPhase: "P2",
    triggerTypes: ["EXECUTION_SUPPORT"],
    outputContract: "task.draft.v1",
  },
};

export function getActiveAgentsForTrigger(triggerType: string): AgentName[] {
  return (Object.keys(AGENT_REGISTRY) as AgentName[]).filter(name => {
    const def = AGENT_REGISTRY[name];
    if (def.status !== "ACTIVE") return false;
    if (def.triggerTypes.includes("*")) return true;
    return def.triggerTypes.includes(triggerType);
  });
}

export async function recordAgentActivation(agentName: AgentName, latencyMs: number): Promise<void> {
  await db
    .update(agentRegistry)
    .set({
      last_activated: new Date(),
      total_activations: sql`${agentRegistry.total_activations} + 1`,
      average_latency_ms: latencyMs,
    })
    .where(eq(agentRegistry.agent_name, agentName))
    .catch(() => null);
}

export async function listAgentsFromDb(): Promise<typeof agentRegistry.$inferSelect[]> {
  return db.select().from(agentRegistry);
}
