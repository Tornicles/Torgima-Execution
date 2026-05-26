/** Pattern, anomaly, and insight extraction from external payloads (Prompt 9). */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function findPatterns(data: Record<string, unknown>): string[] {
  const patterns: string[] = [];
  const revenue = asRecord(data.revenue);
  const customers = asRecord(data.customers);
  const engagement = asRecord(data.engagement);

  if (str(revenue?.trend) === "increasing") {
    patterns.push("Revenue is increasing");
  }
  if (num(customers?.churnRate) > 0.1) {
    patterns.push("High customer churn detected");
  }
  if (num(engagement?.score) > 0.7) {
    patterns.push("Good engagement levels");
  }

  return patterns;
}

export function findAnomalies(data: Record<string, unknown>): string[] {
  const anomalies: string[] = [];
  const employees = asRecord(data.employees);
  const sentiment = asRecord(data.sentiment);

  if (num(employees?.turnover) > 0.15) {
    anomalies.push("Unusual employee turnover");
  }
  if (num(sentiment?.negative) > 0.3) {
    anomalies.push("Negative sentiment detected");
  }

  return anomalies;
}

export function extractInsights(data: Record<string, unknown>): string[] {
  const insights: string[] = [];
  const revenue = asRecord(data.revenue);
  const deals = asRecord(data.deals);
  const metrics = asRecord(data.metrics);

  if (num(revenue?.forecast) > num(revenue?.thisMonth)) {
    insights.push("Revenue forecast is positive");
  }
  if (num(deals?.winRate) > 0.75) {
    insights.push("Sales team has high win rate");
  }
  if (num(metrics?.conversionRate) > 0.1) {
    insights.push("Conversion rate is strong");
  }

  return insights;
}
