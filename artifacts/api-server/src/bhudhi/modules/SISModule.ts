import { db, bhudhiFrameworks, bhudhiStrategicChoices } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recordModuleRun } from "./moduleHelpers.js";
import type { IdeaOption } from "./IISModule.js";

export interface StrategicSelection {
  selected: string;
  reasoning: string;
  alternatives: Array<{ title: string; score: number }>;
  confidence: number;
}

export class SISModule {
  async selectStrategy(
    blueprintId: string,
    options: IdeaOption[],
  ): Promise<StrategicSelection> {
    const started = Date.now();

    const frameworkRows = await db
      .select({ id: bhudhiFrameworks.id, accuracy: bhudhiFrameworks.accuracy })
      .from(bhudhiFrameworks)
      .where(eq(bhudhiFrameworks.status, "active"));
    const frameworks = Array.isArray(frameworkRows) ? frameworkRows : [];

    const scored = options.map((option) => ({
      ...option,
      score: this.scoreOption(option, frameworks),
    }));
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const selected = sorted[0]!;
    const reasoning = `Selected based on highest strategic alignment (${selected.score.toFixed(2)})`;
    const confidence = 0.85;

    await db.insert(bhudhiStrategicChoices).values({
      blueprint_id: blueprintId,
      options: scored,
      selected: selected.title,
      reasoning,
      alignment: selected.score,
      confidence,
    });

    await recordModuleRun("SIS", Date.now() - started);
    return {
      selected: selected.title,
      reasoning,
      alternatives: sorted.slice(1, 3).map((o) => ({ title: o.title, score: o.score })),
      confidence,
    };
  }

  private scoreOption(
    option: IdeaOption,
    frameworks: Array<{ accuracy: number }>,
  ): number {
    if (frameworks.length === 0) return option.score;
    const frameworkAvg =
      frameworks.reduce((sum, f) => sum + f.accuracy, 0) / frameworks.length;
    return (option.score * 0.6 + frameworkAvg * 0.4);
  }
}

export const sisModule = new SISModule();
