import {
  db,
  bhudhiEngines,
  bhudhiInvestigations,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BhudhiInvestigation, BhudhiEngineMetrics } from "@workspace/db/types/bhudhi";
import { INVESTIGATION_ENGINE_RUNNERS } from "./engines.js";
import {
  INVESTIGATION_ENGINE_NAMES,
  subjectForEngine,
  type EngineFindingResult,
  type InvestigationEngineName,
} from "./types.js";
import { logger } from "../../lib/logger.js";

function toInvestigation(row: typeof bhudhiInvestigations.$inferSelect): BhudhiInvestigation {
  const findings = row.findings as BhudhiInvestigation["findings"];
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    engineId: row.engine_id,
    subject: row.subject as BhudhiInvestigation["subject"],
    findings,
    confidence: row.confidence,
    severity: row.severity as BhudhiInvestigation["severity"],
    actionable: row.actionable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function stripMeta(findings: EngineFindingResult): BhudhiInvestigation["findings"] {
  const { confidence: _c, severity: _s, actionable: _a, ...rest } = findings;
  return rest;
}

export class InvestigationService {
  /** Run all 13 investigation engines for a blueprint. */
  async investigateBlueprint(blueprintId: string): Promise<BhudhiInvestigation[]> {
    const engines = await db
      .select()
      .from(bhudhiEngines)
      .where(eq(bhudhiEngines.system_id, "investigation"));

    const investigations: BhudhiInvestigation[] = [];
    const ordered = INVESTIGATION_ENGINE_NAMES.map((name) =>
      engines.find((e) => e.name === name),
    ).filter(Boolean) as typeof engines;

    const toRun = ordered.length > 0 ? ordered : engines;

    for (const engine of toRun) {
      try {
        const result = await this.runEngine(blueprintId, engine.id, engine.name);
        investigations.push(result);
      } catch (err) {
        logger.warn({ err, engineId: engine.id, blueprintId }, "[Investigation] engine failed");
      }
    }

    return investigations;
  }

  /** Run a single engine by id. */
  async runEngineById(blueprintId: string, engineId: string): Promise<BhudhiInvestigation> {
    const [engine] = await db
      .select()
      .from(bhudhiEngines)
      .where(eq(bhudhiEngines.id, engineId))
      .limit(1);
    if (!engine) throw new Error(`Investigation engine not found: ${engineId}`);
    return this.runEngine(blueprintId, engine.id, engine.name);
  }

  private async runEngine(
    blueprintId: string,
    engineId: string,
    engineName: string,
  ): Promise<BhudhiInvestigation> {
    const started = Date.now();
    const runner =
      INVESTIGATION_ENGINE_RUNNERS[engineName as InvestigationEngineName] ??
      INVESTIGATION_ENGINE_RUNNERS["Data Collection Engine"];

    const findings = await runner(blueprintId);
    const elapsed = Date.now() - started;

    const [row] = await db
      .insert(bhudhiInvestigations)
      .values({
        blueprint_id: blueprintId,
        engine_id: engineId,
        subject: subjectForEngine(engineName),
        findings: stripMeta(findings),
        confidence: findings.confidence ?? 0.75,
        severity: findings.severity ?? "low",
        actionable: findings.actionable ?? false,
      })
      .returning();

    await this.updateEngineMetrics(engineId, elapsed, stripMeta(findings));

    return toInvestigation(row!);
  }

  async listInvestigations(blueprintId: string): Promise<BhudhiInvestigation[]> {
    const rows = await db
      .select()
      .from(bhudhiInvestigations)
      .where(eq(bhudhiInvestigations.blueprint_id, blueprintId));
    return rows.map(toInvestigation);
  }

  async getInvestigation(id: string): Promise<BhudhiInvestigation | null> {
    const [row] = await db
      .select()
      .from(bhudhiInvestigations)
      .where(eq(bhudhiInvestigations.id, id))
      .limit(1);
    return row ? toInvestigation(row) : null;
  }

  private async updateEngineMetrics(
    engineId: string,
    elapsedMs: number,
    findings: BhudhiInvestigation["findings"],
  ): Promise<void> {
    const [engine] = await db
      .select()
      .from(bhudhiEngines)
      .where(eq(bhudhiEngines.id, engineId))
      .limit(1);
    if (!engine) return;

    const prev = (engine.metrics ?? {}) as BhudhiEngineMetrics;
    const executionsCount = (prev.executionsCount ?? 0) + 1;
    const resultCount =
      (findings.insights?.length ?? 0) +
      (findings.anomalies?.length ?? 0) +
      (findings.patterns?.length ?? 0);

    const prevAvg = prev.averageExecutionTime ?? 0;
    const averageExecutionTime = Math.round(
      (prevAvg * (executionsCount - 1) + elapsedMs) / executionsCount,
    );

    const metrics: BhudhiEngineMetrics = {
      executionsCount,
      successRate: prev.successRate ?? 0.95,
      averageExecutionTime,
      lastResultCount: resultCount,
    };

    await db
      .update(bhudhiEngines)
      .set({
        metrics,
        last_run_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(bhudhiEngines.id, engineId));
  }
}

export const investigationService = new InvestigationService();
