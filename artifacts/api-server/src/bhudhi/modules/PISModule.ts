import { db, bhudhiPredictions } from "@workspace/db";
import { recordModuleRun } from "./moduleHelpers.js";

export interface OutcomeForecast {
  revenue: number;
  timeline: number;
  probability: number;
  risks: string[];
  opportunities: string[];
  confidence: number;
}

export class PISModule {
  async predictOutcome(
    blueprintId: string,
    recommendation: { title: string },
  ): Promise<OutcomeForecast> {
    const started = Date.now();

    const seed = this.hashTitle(recommendation.title);
    const forecast: OutcomeForecast = {
      revenue: 40000 + (seed % 60000),
      timeline: 2 + (seed % 10),
      probability: 0.6 + (seed % 30) / 100,
      risks: ["Market change", "Resource constraint", "Technical difficulty"],
      opportunities: ["Revenue acceleration", "Market expansion", "Team growth"],
      confidence: 0.75 + (seed % 20) / 100,
    };

    await db.insert(bhudhiPredictions).values({
      blueprint_id: blueprintId,
      scenario: recommendation.title,
      forecast,
      confidence: forecast.confidence,
      timeline: forecast.timeline,
      risks: forecast.risks,
      opportunities: forecast.opportunities,
    });

    await recordModuleRun("PIS", Date.now() - started);
    return forecast;
  }

  private hashTitle(title: string): number {
    let h = 0;
    for (let i = 0; i < title.length; i++) {
      h = (h * 31 + title.charCodeAt(i)) % 1000;
    }
    return h;
  }
}

export const pisModule = new PISModule();
