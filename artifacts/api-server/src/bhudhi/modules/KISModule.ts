import { db, bhudhiFrameworkLearning } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { recordModuleRun } from "./moduleHelpers.js";

export interface KnowledgeApplication {
  applicableLearnings: string[];
  recommendations: string[];
  confidence: number;
}

export class KISModule {
  async applyKnowledge(blueprintId: string, situation: string): Promise<KnowledgeApplication> {
    const started = Date.now();
    void blueprintId;

    const learnings = await db
      .select()
      .from(bhudhiFrameworkLearning)
      .where(eq(bhudhiFrameworkLearning.status, "validated"))
      .orderBy(desc(bhudhiFrameworkLearning.improvement))
      .limit(10);

    const applicable = learnings.filter((l) =>
      this.isSimilarSituation(l.learning_type, situation),
    );

    const result: KnowledgeApplication = {
      applicableLearnings: applicable.map((l) => l.learning_type),
      recommendations: this.generateRecommendations(applicable),
      confidence: Math.min(applicable.length * 0.15, 0.95),
    };

    await recordModuleRun("KIS", Date.now() - started);
    return result;
  }

  private isSimilarSituation(learningType: string, situation: string): boolean {
    const keywords = situation.toLowerCase().split(/\s+/);
    const lt = learningType.toLowerCase();
    return keywords.some((kw) => kw.length > 3 && lt.includes(kw));
  }

  private generateRecommendations(
    learnings: Array<{ learning_type: string }>,
  ): string[] {
    return learnings
      .slice(0, 3)
      .map((l) => `Apply: ${l.learning_type.replace(/_/g, " ")}`);
  }
}

export const kisModule = new KISModule();
