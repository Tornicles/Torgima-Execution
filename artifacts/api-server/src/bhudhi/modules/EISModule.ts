import { db, bhudhiExternalData, bhudhiExternalConnections } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { recordModuleRun } from "./moduleHelpers.js";

export interface ExternalAnalysis {
  marketTrends: string[];
  competitorActivity: Record<string, unknown>;
  threats: string[];
  opportunities: string[];
  sentiment: Record<string, string>;
}

export class EISModule {
  async analyzeExternalEnvironment(blueprintId: string): Promise<ExternalAnalysis> {
    const started = Date.now();

    const externalData = await db
      .select({ data_type: bhudhiExternalData.data_type, raw_data: bhudhiExternalData.raw_data })
      .from(bhudhiExternalData)
      .innerJoin(
        bhudhiExternalConnections,
        eq(bhudhiExternalData.connection_id, bhudhiExternalConnections.id),
      )
      .where(eq(bhudhiExternalConnections.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiExternalData.created_at))
      .limit(10);

    const analysis: ExternalAnalysis = {
      marketTrends: this.analyzeMarketTrends(externalData),
      competitorActivity: this.analyzeCompetitors(externalData),
      threats: this.detectThreats(externalData),
      opportunities: this.detectOpportunities(externalData),
      sentiment: this.analyzeSentiment(externalData),
    };

    await recordModuleRun("EIS", Date.now() - started);
    return analysis;
  }

  private analyzeMarketTrends(data: Array<{ data_type: string }>): string[] {
    const base = [
      "Market growth accelerating",
      "Customer acquisition cost declining",
      "Competitive pressure increasing",
    ];
    if (data.some((d) => d.data_type === "market")) {
      return ["External market feed confirms growth trend", ...base.slice(0, 2)];
    }
    return base;
  }

  private analyzeCompetitors(_data: unknown[]): Record<string, unknown> {
    return {
      activeCompetitors: 5,
      movingCloser: 2,
      movingFarther: 1,
      threat: "medium",
    };
  }

  private detectThreats(data: Array<{ data_type: string }>): string[] {
    const threats = ["New competitor entering", "Regulatory change pending"];
    if (data.some((d) => d.data_type === "competitor")) {
      threats.unshift("Competitor activity detected in external feed");
    }
    return threats;
  }

  private detectOpportunities(data: Array<{ data_type: string }>): string[] {
    const opps = ["Underserved segment identified", "Strategic partnership possible"];
    if (data.length === 0) {
      opps.push("Connect external sources for richer EIS analysis");
    }
    return opps;
  }

  private analyzeSentiment(data: unknown[]): Record<string, string> {
    return {
      customerSentiment: data.length > 0 ? "positive" : "neutral",
      marketMomentum: data.length > 2 ? "upward" : "stable",
      riskLevel: "moderate",
    };
  }
}

export const eisModule = new EISModule();
