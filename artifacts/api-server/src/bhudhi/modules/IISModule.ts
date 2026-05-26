import { db, bhudhiIdeaSets } from "@workspace/db";
import { recordModuleRun } from "./moduleHelpers.js";

export interface IdeaOption {
  id: string;
  title: string;
  description: string;
  feasibility: number;
  impact: number;
  timeline: string;
  score: number;
}

export interface IdeaGenerationResult {
  problem: string;
  ideas: IdeaOption[];
  topIdea: IdeaOption;
}

const BASE_IDEAS: Omit<IdeaOption, "score">[] = [
  { id: "idea_1", title: "Conservative approach", description: "Minimize risk, steady progress", feasibility: 0.95, impact: 0.6, timeline: "4 weeks" },
  { id: "idea_2", title: "Aggressive approach", description: "Maximum impact, higher risk", feasibility: 0.65, impact: 0.95, timeline: "2 weeks" },
  { id: "idea_3", title: "Hybrid approach", description: "Balance speed and safety", feasibility: 0.85, impact: 0.8, timeline: "3 weeks" },
  { id: "idea_4", title: "Experimental approach", description: "Test assumptions first", feasibility: 0.75, impact: 0.5, timeline: "2 weeks" },
  { id: "idea_5", title: "Parallel approach", description: "Multiple paths simultaneously", feasibility: 0.6, impact: 0.85, timeline: "3 weeks" },
];

export class IISModule {
  async generateIdeas(blueprintId: string, problem: string): Promise<IdeaGenerationResult> {
    const started = Date.now();

    const evaluated: IdeaOption[] = BASE_IDEAS.map((idea) => ({
      ...idea,
      score: idea.feasibility * idea.impact,
    })).sort((a, b) => b.score - a.score);

    const topIdea = evaluated[0]!;

    await db.insert(bhudhiIdeaSets).values({
      blueprint_id: blueprintId,
      problem,
      ideas: evaluated,
      feasibility: evaluated.map((i) => i.feasibility),
      top_idea: topIdea.id,
    });

    await recordModuleRun("IIS", Date.now() - started);
    return { problem, ideas: evaluated, topIdea };
  }
}

export const iisModule = new IISModule();
