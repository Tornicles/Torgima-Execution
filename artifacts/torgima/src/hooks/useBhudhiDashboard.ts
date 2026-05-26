import { useCallback, useEffect, useState } from "react";
import {
  calculateBhudhiSignals,
  fetchBhudhiConnections,
  fetchBhudhiInsights,
  fetchBhudhiRecommendations,
  fetchBhudhiSignals,
  fetchBhudhiStatus,
  type BhudhiConnectionsPayload,
  type BhudhiInsightsPayload,
  type BhudhiRecommendationsPayload,
  type BhudhiSignalsPayload,
  type BhudhiStatusPayload,
} from "@/lib/bhudhi-api";

const REFRESH_MS = 30_000;

export function useBhudhiDashboard(blueprintId: string | null | undefined) {
  const [status, setStatus] = useState<BhudhiStatusPayload | null>(null);
  const [signals, setSignals] = useState<BhudhiSignalsPayload | null>(null);
  const [insights, setInsights] = useState<BhudhiInsightsPayload | null>(null);
  const [recommendations, setRecommendations] = useState<BhudhiRecommendationsPayload | null>(null);
  const [connections, setConnections] = useState<BhudhiConnectionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!blueprintId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const [statusRes, signalsRes, insightsRes, recsRes, connRes] = await Promise.all([
        fetchBhudhiStatus(blueprintId),
        fetchBhudhiSignals(blueprintId),
        fetchBhudhiInsights(blueprintId),
        fetchBhudhiRecommendations(blueprintId),
        fetchBhudhiConnections(blueprintId),
      ]);

      setStatus(statusRes);
      setSignals(signalsRes);
      setInsights(insightsRes);
      setRecommendations(recsRes);
      setConnections(connRes);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Bhudhi dashboard");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    setLoading(true);
    void loadDashboard();
    const interval = setInterval(() => void loadDashboard(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const refreshSignals = useCallback(async () => {
    if (!blueprintId) return;
    const next = await calculateBhudhiSignals(blueprintId);
    if (next) setSignals(next);
  }, [blueprintId]);

  return {
    status,
    signals,
    insights,
    recommendations,
    connections,
    loading,
    error,
    lastUpdated,
    reload: loadDashboard,
    refreshSignals,
  };
}
