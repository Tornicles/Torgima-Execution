import { db, bhudhiGovernanceEmergency } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import type { EmergencyMode, GovernanceContext } from "../contracts/types.js";

export type EmergencyTrigger =
  | "unsafe_execution"
  | "recursive_failures"
  | "budget_exceeded"
  | "memory_corruption"
  | "critical_hallucination"
  | "agent_conflict";

export class EmergencyGovernor {
  async getActiveMode(blueprintId?: string): Promise<EmergencyMode | null> {
    const rows = await db
      .select({ mode: bhudhiGovernanceEmergency.mode })
      .from(bhudhiGovernanceEmergency)
      .where(
        blueprintId
          ? and(
              eq(bhudhiGovernanceEmergency.blueprint_id, blueprintId),
              eq(bhudhiGovernanceEmergency.active, true),
            )
          : eq(bhudhiGovernanceEmergency.active, true),
      )
      .orderBy(desc(bhudhiGovernanceEmergency.activated_at))
      .limit(1);

    return (rows[0]?.mode as EmergencyMode) ?? null;
  }

  async activate(
    blueprintId: string | undefined,
    mode: EmergencyMode,
    trigger: EmergencyTrigger,
    metadata: Record<string, unknown> = {},
  ): Promise<string> {
    const [row] = await db
      .insert(bhudhiGovernanceEmergency)
      .values({
        blueprint_id: blueprintId ?? null,
        mode,
        trigger,
        active: true,
        metadata,
      })
      .returning({ id: bhudhiGovernanceEmergency.id });

    return row!.id;
  }

  async clear(blueprintId: string): Promise<void> {
    await db
      .update(bhudhiGovernanceEmergency)
      .set({ active: false, cleared_at: new Date() })
      .where(
        and(
          eq(bhudhiGovernanceEmergency.blueprint_id, blueprintId),
          eq(bhudhiGovernanceEmergency.active, true),
        ),
      );
  }

  blocksExecution(mode: EmergencyMode | null): boolean {
    return mode === "FREEZE" || mode === "READ_ONLY" || mode === "SOFT_STOP";
  }

  shouldTriggerFromContext(context: GovernanceContext, failureCount = 0): EmergencyTrigger | null {
    if (failureCount >= 5) return "recursive_failures";
    if ((context.costEstimate ?? 0) > 50000) return "budget_exceeded";
    if (context.globalSignal === "danger" && (context.confidence ?? 1) < 0.2) {
      return "unsafe_execution";
    }
    return null;
  }
}

export const emergencyGovernor = new EmergencyGovernor();
