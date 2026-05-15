import { db, blueprints, blueprintMembers, signalSnapshots } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { parseMode } from "../BlueprintRuleEngine.js";
import {
  aggregateTeamSignals,
  type MemberSignalInput,
  type TeamSignalSnapshot,
} from "./TeamSignalAggregationEngine.js";

export async function aggregateAndPersistTeamSignal(
  blueprintId: string,
): Promise<TeamSignalSnapshot | null> {
  const [bp] = await db
    .select({ mode: blueprints.mode, blueprint_config: blueprints.blueprint_config })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  if (!bp || parseMode(bp.mode) !== "team") return null;

  const members = await db
    .select({ user_id: blueprintMembers.user_id })
    .from(blueprintMembers)
    .where(and(eq(blueprintMembers.blueprint_id, blueprintId), eq(blueprintMembers.active, true)));

  const memberInputs: MemberSignalInput[] = [];

  for (const m of members) {
    const [snap] = await db
      .select({
        completion_rate: signalSnapshots.completion_rate,
        momentum: signalSnapshots.momentum,
        operational_mathematics_json: signalSnapshots.operational_mathematics_json,
      })
      .from(signalSnapshots)
      .where(
        and(
          eq(signalSnapshots.blueprint_id, blueprintId),
          eq(signalSnapshots.user_id, m.user_id),
          eq(signalSnapshots.is_current, true),
        ),
      )
      .limit(1);

    const om = snap?.operational_mathematics_json as {
      scores?: { proof_reliability?: { normalized?: number } };
    } | null;

    memberInputs.push({
      userId: m.user_id,
      completionRate: snap?.completion_rate ?? 0,
      momentum: snap?.momentum ?? 0,
      proofReliability: om?.scores?.proof_reliability?.normalized ?? 0.5,
      activeOrderLoad: 1,
    });
  }

  const teamSignal = aggregateTeamSignals(memberInputs);
  const config = (bp.blueprint_config ?? {}) as Record<string, unknown>;

  await db
    .update(blueprints)
    .set({
      blueprint_config: {
        ...config,
        team_signal: teamSignal,
        team_signal_updated_at: new Date().toISOString(),
      },
    })
    .where(eq(blueprints.id, blueprintId));

  return teamSignal;
}

export function readTeamSignalFromConfig(
  blueprintConfig: unknown,
): TeamSignalSnapshot | null {
  if (!blueprintConfig || typeof blueprintConfig !== "object") return null;
  const ts = (blueprintConfig as { team_signal?: TeamSignalSnapshot }).team_signal;
  return ts ?? null;
}
