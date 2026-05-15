import { db, blueprints, plans, phases, projects, actions, targets, signalSnapshots } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { buildOperationalGraph } from "./OperationalGraphEngine.js";
import { deriveOperationalState } from "./BlueprintFailureStates.js";
import { getClientFeatureManifest } from "./BlueprintTypeRegistry.js";
import { parseMode, parseTier } from "../BlueprintRuleEngine.js";
import type { BlueprintMode } from "./blueprint-types.js";
import { deriveExecutionRhythm } from "./ExecutionRhythmEngine.js";

const cache = new Map<string, { at: number; payload: unknown }>();
const TTL_MS = 30_000;

export async function hydrateBlueprintInfrastructure(blueprintId: string, userId: string) {
  const cacheKey = `${blueprintId}:${userId}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.payload;
  }

  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!bp) return null;

  const tier = parseTier(bp.tier);
  const mode = parseMode(bp.mode);

  const [planRows, targetRows, phaseRows, projectRows, actionRows, snap] = await Promise.all([
    db.select().from(plans).where(eq(plans.blueprint_id, blueprintId)),
    db.select().from(targets).where(eq(targets.blueprint_id, blueprintId)),
    db.select().from(phases).where(eq(phases.blueprint_id, blueprintId)),
    db.select().from(projects).where(eq(projects.blueprint_id, blueprintId)),
    db.select().from(actions).where(eq(actions.blueprint_id, blueprintId)),
    db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  const operationalState = deriveOperationalState({
    blueprintStatus: bp.status,
    condition: bp.current_condition,
    momentum: snap?.momentum ?? 0,
    completionRate: snap?.completion_rate ?? 0,
  });

  const graph = buildOperationalGraph({
    goal: bp.goal,
    plans: planRows.map((p) => ({ id: p.id, name: p.name, status: p.status })),
    targets: targetRows.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      planId: t.plan_id,
    })),
    phases: phaseRows.map((ph) => ({
      id: ph.id,
      name: ph.name,
      status: ph.status,
      targetId: ph.target_id,
    })),
    projects: projectRows.map((pr) => ({
      id: pr.id,
      name: pr.name,
      status: pr.status,
      phaseId: pr.phase_id,
    })),
    actions: actionRows.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      projectId: a.project_id,
    })),
    dependencies: [],
    operationalState,
  });

  const payload = {
    blueprintId,
    tier,
    mode,
    operationalState,
    featureManifest: getClientFeatureManifest(tier, mode),
    graph,
    rhythm: deriveExecutionRhythm(tier, bp.commitment_level),
    version: bp.version,
    stateVersion: bp.state_version,
  };

  cache.set(cacheKey, { at: Date.now(), payload });
  return payload;
}

export function invalidateHydrationCache(blueprintId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${blueprintId}:`)) cache.delete(key);
  }
}
