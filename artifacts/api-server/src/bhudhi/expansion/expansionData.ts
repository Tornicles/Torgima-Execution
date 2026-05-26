import { randomUUID } from "node:crypto";
import {
  db,
  bhudhiExpansionCapabilities,
  bhudhiExpansionEvents,
  bhudhiExpansionBenchmarks,
  bhudhiExpansionHistory,
  bhudhiExpansionMemory,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type {
  BenchmarkResult,
  DiscoveredCapability,
  EvaluationResult,
  ExpansionOutput,
} from "./contracts/types.js";

export async function persistExpansionCycle(
  output: ExpansionOutput,
  blueprintId: string,
  candidates: DiscoveredCapability[],
  evaluation: EvaluationResult,
  benchmark: BenchmarkResult | null,
): Promise<void> {
  for (const c of candidates) {
    const id = c.capabilityId ?? randomUUID();
    await db.insert(bhudhiExpansionCapabilities).values({
      id,
      blueprint_id: blueprintId,
      capability_key: c.capability,
      origin: c.origin,
      level: output.level ?? "LOCAL",
      status: output.approval ? "promoted" : evaluation.action === "reject" ? "rejected" : "candidate",
      score: c.score,
      risk: output.risk,
      dependencies: [],
      snapshot: c,
    });
    c.capabilityId = id;

    if (benchmark) {
      await db.insert(bhudhiExpansionBenchmarks).values({
        capability_id: id,
        gain: benchmark.gain,
        cost: benchmark.cost,
        confidence: benchmark.confidence,
        benchmark,
      });
    }
  }

  await db.insert(bhudhiExpansionEvents).values({
    blueprint_id: blueprintId,
    capability_id: candidates[0]?.capabilityId ?? null,
    event_type: "cycle_complete",
    payload: { confidence: output.confidence, risk: output.risk, approval: output.approval },
  });

  await db.insert(bhudhiExpansionHistory).values({
    blueprint_id: blueprintId,
    action: evaluation.action,
    capability_key: candidates[0]?.capability,
    detail: { evaluation, recommendation: output.recommendation },
  });

  await db.insert(bhudhiExpansionMemory).values({
    blueprint_id: blueprintId,
    memory_type: "cycle",
    snapshot: output,
    memory_class: "ACTIVE",
  });
}

export async function updateCapabilityStatus(
  capabilityId: string,
  status: string,
  blueprintId: string,
  action: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  await db
    .update(bhudhiExpansionCapabilities)
    .set({ status, updated_at: new Date() })
    .where(eq(bhudhiExpansionCapabilities.id, capabilityId));

  await db.insert(bhudhiExpansionHistory).values({
    blueprint_id: blueprintId,
    action,
    capability_key: capabilityId,
    detail: { status, ...extra },
  });
}

export async function getExpansionStatus(blueprintId: string) {
  const capabilities = await listCapabilities(blueprintId, 200);
  const history = await listExpansionHistory(blueprintId, 10);

  const activeCapabilities = capabilities.filter((c) => c.status === "promoted").length;
  const proposedCapabilities = capabilities.filter((c) => c.status === "candidate").length;
  const pendingApprovals = capabilities.filter(
    (c) => c.status === "candidate" && c.score >= 0.5,
  ).length;
  const testing = capabilities.filter((c) => c.status === "testing").length;

  return {
    activeCapabilities,
    proposedCapabilities,
    pendingApprovals,
    testingInProgress: testing,
    totalCapabilities: capabilities.length,
    canExpand: activeCapabilities < 1000,
    governanceRules: [
      "Every capability requires explicit approval",
      "No self-modification without human decision",
      "All changes reversible via rollback",
      "Critical risk requires human review",
      "Max 1000 active capabilities",
    ],
    recentHistory: history,
    capabilities: capabilities.slice(0, 20),
  };
}

export async function listExpansionHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiExpansionHistory)
    .where(eq(bhudhiExpansionHistory.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiExpansionHistory.created_at))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    capabilityKey: r.capability_key,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}

export async function listCapabilities(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiExpansionCapabilities)
    .where(eq(bhudhiExpansionCapabilities.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiExpansionCapabilities.updated_at))
    .limit(limit);

  return rows.map((r) => ({
    capabilityId: r.id,
    capabilityKey: r.capability_key,
    origin: r.origin,
    level: r.level,
    status: r.status,
    score: r.score,
    risk: r.risk,
  }));
}
