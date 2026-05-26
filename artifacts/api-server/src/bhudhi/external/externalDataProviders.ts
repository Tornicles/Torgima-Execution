import type { ExternalSystemType } from "./types.js";

/** Simulated CRM payload (Salesforce, HubSpot, etc.). */
export function fetchCRMData(): Record<string, unknown> {
  return {
    customers: {
      total: 150,
      newThisMonth: 25,
      churnRate: 0.05,
      avgLifetimeValue: 5000,
    },
    revenue: {
      thisMonth: 75000,
      forecast: 85000,
      trend: "increasing",
    },
    opportunities: {
      open: 45,
      value: 250000,
      closureRate: 0.35,
    },
    deals: {
      won: 12,
      lost: 3,
      winRate: 0.8,
    },
  };
}

export function fetchHRMSData(): Record<string, unknown> {
  return {
    employees: {
      total: 45,
      newHires: 5,
      turnover: 0.08,
    },
    engagement: {
      score: 0.75,
      trend: "improving",
    },
    performance: {
      avgRating: 3.8,
      highPerformers: 12,
      needsImprovement: 3,
    },
    compensation: {
      totalPayroll: 450000,
      avgSalary: 10000,
      budget: 500000,
    },
  };
}

export function fetchDataPlatformData(): Record<string, unknown> {
  return {
    metrics: {
      activeUsers: 250,
      engagementRate: 0.65,
      conversionRate: 0.12,
    },
    trends: {
      growth: 0.15,
      retention: 0.85,
      churn: 0.15,
    },
    anomalies: {
      detected: 2,
      severity: "low",
    },
  };
}

export function fetchCommunicationData(): Record<string, unknown> {
  return {
    channels: {
      active: 25,
      messages_per_day: 450,
    },
    sentiment: {
      positive: 0.7,
      neutral: 0.2,
      negative: 0.1,
    },
    engagement: {
      active_users: 40,
      participation_rate: 0.88,
    },
    topics: {
      top_discussions: ["Product roadmap", "Customer feedback", "Team updates"],
      sentiment_by_topic: {
        "Product roadmap": 0.75,
        "Customer feedback": 0.65,
        "Team updates": 0.8,
      },
    },
  };
}

export async function fetchCustomData(
  apiEndpoint: string,
  headers: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  if (!apiEndpoint || !/^https?:\/\//i.test(apiEndpoint)) {
    return { status: "mock", message: "Custom connector ready (no live endpoint)" };
  }

  try {
    const response = await fetch(apiEndpoint, { headers, method: "GET" });
    if (!response.ok) return null;
    const json = (await response.json()) as unknown;
    if (json && typeof json === "object") return json as Record<string, unknown>;
    return { result: json };
  } catch {
    return null;
  }
}

export function fetchDataBySystemType(
  systemType: ExternalSystemType,
  apiEndpoint: string,
  headers: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  switch (systemType) {
    case "crm":
      return Promise.resolve(fetchCRMData());
    case "hrms":
      return Promise.resolve(fetchHRMSData());
    case "data_platform":
      return Promise.resolve(fetchDataPlatformData());
    case "communication":
      return Promise.resolve(fetchCommunicationData());
    case "custom":
      return fetchCustomData(apiEndpoint, headers);
    default:
      return Promise.resolve(null);
  }
}
