/**
 * Health sync stubs — wire Apple HealthKit / Google Fit native modules in production builds.
 */
import { offlineQueue } from "../utils/offlineQueue";
import { api } from "./apiClient";

export type HealthMetrics = {
  steps?: number;
  activeMinutes?: number;
  caloriesBurned?: number;
  heartRate?: number;
  sleepHours?: number;
  source?: string;
};

export async function syncHealthData(metrics: HealthMetrics) {
  const payload = {
    ...metrics,
    source: metrics.source ?? "apple-health",
    metricDate: new Date().toISOString().slice(0, 10),
  };

  await offlineQueue.addAction({
    type: "create",
    resource: "health-metrics",
    payload,
  });

  try {
    await api.post("/mobile/health-metrics", payload);
  } catch {
    /* queued for batch sync */
  }
}

export async function connectWearable(provider: "fitbit" | "oura", oauthToken?: string) {
  return api.post("/mobile/wearable/connect", { provider, oauthToken });
}
