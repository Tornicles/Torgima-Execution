import { db, bhudhiFrameworks, bhudhiFrameworkLearning } from "@workspace/db";
import { eq } from "drizzle-orm";
import { FRAMEWORK_CATALOG } from "./frameworkCatalog.js";
import { TEAM_FRAMEWORK_EVALUATORS } from "./teamEvaluators.js";
import { INDIVIDUAL_FRAMEWORK_EVALUATORS } from "./individualEvaluator.js";
import { normalizeFrameworkName } from "./frameworkNameAliases.js";
import type { FrameworkEvaluationResult, InvestigationInput } from "./types.js";
import { investigationService } from "../investigation/InvestigationService.js";

const ALL_EVALUATORS: Record<string, (inv: InvestigationInput) => FrameworkEvaluationResult> = {
  ...TEAM_FRAMEWORK_EVALUATORS,
  ...INDIVIDUAL_FRAMEWORK_EVALUATORS,
};

export class FrameworksService {
  /** Upsert all 15 frameworks with Prompt 6 logic metadata. */
  async initializeFrameworks(): Promise<number> {
    const now = new Date();
    for (const fw of FRAMEWORK_CATALOG) {
      await db
        .insert(bhudhiFrameworks)
        .values({
          id: fw.id,
          name: fw.name,
          type: fw.type,
          description: fw.description,
          domains: fw.domains,
          status: fw.status ?? "active",
          version: 1,
          logic: { type: fw.name, role: fw.role, prompt: 6 },
          accuracy: 0.75,
          confidence_threshold: 0.7,
          improvement_history: [],
          weekly_accuracy: [],
        })
        .onConflictDoUpdate({
          target: bhudhiFrameworks.id,
          set: {
            description: fw.description,
            domains: fw.domains,
            status: fw.status ?? "active",
            logic: { type: fw.name, role: fw.role, prompt: 6 },
            updated_at: now,
          },
        });
    }
    return FRAMEWORK_CATALOG.length;
  }

  evaluateFramework(
    frameworkName: string,
    investigations: InvestigationInput,
  ): FrameworkEvaluationResult | null {
    const canonical = normalizeFrameworkName(frameworkName);
    const evaluator = ALL_EVALUATORS[canonical];
    if (!evaluator) return null;
    return evaluator(investigations);
  }

  async evaluateFrameworkForBlueprint(
    blueprintId: string,
    frameworkName: string,
  ): Promise<FrameworkEvaluationResult | null> {
    const investigations = await investigationService.listInvestigations(blueprintId);
    return this.evaluateFramework(frameworkName, investigations);
  }

  async evaluateAllForBlueprint(blueprintId: string): Promise<Record<string, FrameworkEvaluationResult>> {
    const investigations = await investigationService.listInvestigations(blueprintId);
    const results: Record<string, FrameworkEvaluationResult> = {};
    for (const fw of FRAMEWORK_CATALOG) {
      const evalResult = this.evaluateFramework(fw.name, investigations);
      if (evalResult) results[fw.name] = evalResult;
    }
    return results;
  }

  async updateFrameworkAccuracy(
    frameworkId: string,
    actualOutcome: number,
    predictedOutcome: number,
  ) {
    const [framework] = await db
      .select()
      .from(bhudhiFrameworks)
      .where(eq(bhudhiFrameworks.id, frameworkId))
      .limit(1);

    if (!framework) return null;

    const error = Math.abs(actualOutcome - predictedOutcome);
    const newAccuracy = Math.max(0, Math.min(1, 1 - error));
    const prevAccuracy = framework.accuracy;
    const blendedAccuracy = Math.round(((prevAccuracy + newAccuracy) / 2) * 100) / 100;

    const weekly = (framework.weekly_accuracy as number[]) ?? [];
    const weeklyAccuracy = [...weekly, newAccuracy].slice(-52);

    const [updated] = await db
      .update(bhudhiFrameworks)
      .set({
        accuracy: blendedAccuracy,
        version: framework.version + 1,
        weekly_accuracy: weeklyAccuracy,
        updated_at: new Date(),
      })
      .where(eq(bhudhiFrameworks.id, frameworkId))
      .returning();

    await db.insert(bhudhiFrameworkLearning).values({
      framework_id: frameworkId,
      learning_type: "accuracy_improvement",
      previous_accuracy: prevAccuracy,
      new_accuracy: newAccuracy,
      improvement: newAccuracy - prevAccuracy,
      source_event: null,
      evidence: { error, actualOutcome, predictedOutcome },
      status: "validated",
    });

    return updated;
  }

  listFrameworkNames(): string[] {
    return FRAMEWORK_CATALOG.map((f) => f.name);
  }
}

export const frameworksService = new FrameworksService();
